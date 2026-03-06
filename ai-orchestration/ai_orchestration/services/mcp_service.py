from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .command_runner import CommandRunner
from .git_service import GitService
from .ollama_client import OllamaClient


class LocalMcpService:
    """
    V1 local MCP adapter.

    It exposes read-only tool servers with explicit allowlists:
    - git
    - filesystem
    - ollama
    - docker
    """

    def __init__(
        self,
        *,
        repo_root: Path,
        config_file: Path,
        git: GitService,
        ollama: OllamaClient,
        runner: CommandRunner | None = None,
    ) -> None:
        self.repo_root = repo_root
        self.config_file = config_file
        self.git = git
        self.ollama = ollama
        self.runner = runner or CommandRunner()
        self.config = self._load_config()

    def list_servers(self) -> dict[str, Any]:
        servers = self.config.get("servers", {})
        output: dict[str, Any] = {}
        for name, payload in servers.items():
            if not isinstance(payload, dict):
                continue
            if not bool(payload.get("enabled", True)):
                continue
            actions = payload.get("actions") or {}
            output[name] = {
                "description": str(payload.get("description", "")).strip(),
                "actions": sorted(str(action) for action in actions.keys()),
            }
        return output

    def call(self, server: str, action: str, params: dict[str, Any] | None = None) -> Any:
        params = params or {}
        server_name = server.strip().lower()
        action_name = action.strip().lower()

        server_config = self._get_server_config(server_name)
        actions = server_config.get("actions") or {}
        if action_name not in actions:
            raise ValueError(f"Action '{action_name}' is not enabled for MCP server '{server_name}'.")

        dispatcher = {
            "git": self._call_git,
            "filesystem": self._call_filesystem,
            "ollama": self._call_ollama,
            "docker": self._call_docker,
        }
        if server_name not in dispatcher:
            raise ValueError(f"Unsupported MCP server '{server_name}'.")

        return dispatcher[server_name](action_name, params)

    def _call_git(self, action: str, params: dict[str, Any]) -> Any:
        if action == "status":
            return {
                "branch": self.git.current_branch(),
                "dirty_files": self.git.changed_files(),
            }
        if action == "branch":
            return {"branch": self.git.current_branch()}
        if action == "log":
            max_count = int(params.get("max_count", 10))
            max_count = max(1, min(max_count, 50))
            result = self.git.run(
                ["log", "--oneline", f"--max-count={max_count}"],
                check=False,
            )
            return {"entries": result.stdout.splitlines() if result.stdout else []}
        raise ValueError(f"Unsupported git MCP action '{action}'.")

    def _call_filesystem(self, action: str, params: dict[str, Any]) -> Any:
        if action != "read_text":
            raise ValueError(f"Unsupported filesystem MCP action '{action}'.")

        raw_path = str(params.get("path", "")).strip()
        if not raw_path:
            raise ValueError("filesystem.read_text requires 'path'.")
        resolved = self._resolve_repo_path(raw_path)
        if not resolved.is_file():
            raise ValueError(f"Path is not a file: {raw_path}")

        max_chars = int(params.get("max_chars", 6000))
        max_chars = max(200, min(max_chars, 20000))
        content = resolved.read_text(encoding="utf-8", errors="replace")
        return {
            "path": str(resolved.relative_to(self.repo_root)).replace("\\", "/"),
            "truncated": len(content) > max_chars,
            "content": content[:max_chars],
        }

    def _call_ollama(self, action: str, params: dict[str, Any]) -> Any:
        if action == "health":
            return {"healthy": self.ollama.health_check()}
        if action == "list_models":
            models = sorted(self.ollama.list_models())
            return {"models": models}
        raise ValueError(f"Unsupported ollama MCP action '{action}'.")

    def _call_docker(self, action: str, params: dict[str, Any]) -> Any:
        if action != "list_containers":
            raise ValueError(f"Unsupported docker MCP action '{action}'.")

        result = self.runner.run(
            [
                "docker",
                "ps",
                "--format",
                "{{json .}}",
            ],
            check=False,
            timeout=120,
        )
        if result.returncode != 0:
            return {"available": False, "error": result.stderr or result.stdout}

        containers = []
        for line in result.stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                containers.append(json.loads(line))
            except json.JSONDecodeError:
                containers.append({"raw": line})
        return {"available": True, "containers": containers}

    def _resolve_repo_path(self, raw_path: str) -> Path:
        candidate = (self.repo_root / raw_path).resolve()
        repo_resolved = self.repo_root.resolve()
        if repo_resolved not in candidate.parents and candidate != repo_resolved:
            raise ValueError("Path escapes repository root.")
        return candidate

    def _get_server_config(self, server: str) -> dict[str, Any]:
        servers = self.config.get("servers", {})
        payload = servers.get(server)
        if not isinstance(payload, dict):
            raise ValueError(f"MCP server '{server}' is not configured.")
        if not bool(payload.get("enabled", True)):
            raise ValueError(f"MCP server '{server}' is disabled.")
        return payload

    def _load_config(self) -> dict[str, Any]:
        if not self.config_file.exists():
            return self._default_config()

        suffix = self.config_file.suffix.lower()
        text = self.config_file.read_text(encoding="utf-8")
        if suffix == ".json":
            data = json.loads(text)
        else:
            try:
                import yaml  # type: ignore
            except ModuleNotFoundError:
                return self._default_config()
            data = yaml.safe_load(text)  # type: ignore[attr-defined]

        if not isinstance(data, dict):
            return self._default_config()
        if "servers" not in data or not isinstance(data["servers"], dict):
            return self._default_config()
        return data

    def _default_config(self) -> dict[str, Any]:
        return {
            "servers": {
                "git": {
                    "enabled": True,
                    "description": "Read-only git introspection.",
                    "actions": {"status": {}, "branch": {}, "log": {}},
                },
                "filesystem": {
                    "enabled": True,
                    "description": "Read-only file access inside repository root.",
                    "actions": {"read_text": {"max_chars": 6000}},
                },
                "ollama": {
                    "enabled": True,
                    "description": "Local Ollama runtime and model inspection.",
                    "actions": {"health": {}, "list_models": {}},
                },
                "docker": {
                    "enabled": True,
                    "description": "Read-only container listing from local Docker Desktop.",
                    "actions": {"list_containers": {}},
                },
            }
        }
