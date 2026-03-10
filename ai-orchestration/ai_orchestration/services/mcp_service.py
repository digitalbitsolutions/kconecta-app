from __future__ import annotations

import json
import os
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
        if action == "list_containers":
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

        if action == "run_backend_tests":
            return self._run_backend_tests(params)

        raise ValueError(f"Unsupported docker MCP action '{action}'.")

    def _run_backend_tests(self, params: dict[str, Any]) -> dict[str, Any]:
        backend_root = self._resolve_backend_root(str(params.get("backend_root", "")).strip())
        compose_file = backend_root / "docker-compose.yml"
        if not compose_file.exists():
            raise ValueError(f"docker-compose.yml not found in backend root: {backend_root}")

        services_result = self.runner.run(
            ["docker", "compose", "-f", str(compose_file), "config", "--services"],
            cwd=backend_root,
            check=False,
            timeout=120,
        )
        if services_result.returncode != 0:
            return {
                "success": False,
                "backend_root": str(backend_root),
                "error": services_result.stderr or services_result.stdout,
            }

        available_services = {
            line.strip()
            for line in services_result.stdout.splitlines()
            if line.strip()
        }
        app_service = self._select_service(
            available=available_services,
            explicit=str(params.get("app_service", "")).strip() or None,
            candidates=["app", "php", "backend"],
        )
        if not app_service:
            raise ValueError(
                "No PHP app service found in compose file. "
                f"Available services: {sorted(available_services)}"
            )

        db_service = self._select_service(
            available=available_services,
            explicit=str(params.get("db_service", "")).strip() or None,
            candidates=["mysql", "db", "database"],
        )

        up_command = ["docker", "compose", "-f", str(compose_file), "up", "-d", app_service]
        if db_service:
            up_command.append(db_service)

        up_result = self.runner.run(
            up_command,
            cwd=backend_root,
            check=False,
            timeout=900,
        )
        if up_result.returncode != 0:
            return {
                "success": False,
                "backend_root": str(backend_root),
                "command": up_command,
                "stdout": up_result.stdout,
                "stderr": up_result.stderr,
            }

        ensure_env_file = bool(params.get("ensure_env_file", True))
        env_prepare_result = None
        if ensure_env_file:
            env_prepare_command = [
                "docker",
                "compose",
                "-f",
                str(compose_file),
                "exec",
                "-T",
                app_service,
                "sh",
                "-lc",
                "if [ ! -f .env ]; then cp .env.example .env; fi",
            ]
            env_prepare_result = self.runner.run(
                env_prepare_command,
                cwd=backend_root,
                check=False,
                timeout=300,
            )
            if env_prepare_result.returncode != 0:
                return {
                    "success": False,
                    "backend_root": str(backend_root),
                    "command": env_prepare_command,
                    "stdout": env_prepare_result.stdout,
                    "stderr": env_prepare_result.stderr,
                }

        overrides = {
            "APP_ENV": "testing",
            "CACHE_STORE": "array",
            "DB_CONNECTION": "sqlite",
            "DB_DATABASE": ":memory:",
            "SESSION_DRIVER": "array",
            "QUEUE_CONNECTION": "sync",
            "MAIL_MAILER": "array",
            "BROADCAST_CONNECTION": "null",
            "PULSE_ENABLED": "false",
            "TELESCOPE_ENABLED": "false",
            "NIGHTWATCH_ENABLED": "false",
        }
        test_command = [
            "docker",
            "compose",
            "-f",
            str(compose_file),
            "exec",
            "-T",
        ]
        for key, value in overrides.items():
            test_command.extend(["-e", f"{key}={value}"])
        test_command.extend([app_service, "php", "artisan", "test"])

        phpunit_filter = str(params.get("filter", "")).strip()
        if phpunit_filter:
            test_command.extend(["--filter", phpunit_filter])

        test_result = self.runner.run(
            test_command,
            cwd=backend_root,
            check=False,
            timeout=1800,
        )
        return {
            "success": test_result.returncode == 0,
            "backend_root": str(backend_root),
            "compose_file": str(compose_file),
            "app_service": app_service,
            "db_service": db_service,
            "ensure_env_file": ensure_env_file,
            "filter": phpunit_filter or None,
            "command": test_command,
            "returncode": test_result.returncode,
            "stdout": test_result.stdout,
            "stderr": test_result.stderr,
            "env_prepare_returncode": (
                env_prepare_result.returncode if env_prepare_result else None
            ),
        }

    def _select_service(
        self,
        *,
        available: set[str],
        explicit: str | None,
        candidates: list[str],
    ) -> str | None:
        if explicit:
            return explicit if explicit in available else None

        for candidate in candidates:
            if candidate in available:
                return candidate
        return None

    def _resolve_backend_root(self, explicit: str) -> Path:
        candidates: list[Path] = []
        if explicit:
            candidates.append(Path(explicit))

        env_path = os.environ.get("CRM_BACKEND_ROOT", "").strip()
        if env_path:
            candidates.append(Path(env_path))

        candidates.append(self.repo_root.parent / "kconecta.com" / "web")
        candidates.append(Path(r"D:\still\kconecta.com\web"))

        for candidate in candidates:
            root = candidate.expanduser()
            if (root / "docker-compose.yml").exists():
                return root

        checked = ", ".join(str(path) for path in candidates)
        raise ValueError(
            "Could not resolve backend root for docker tests. "
            f"Checked: {checked}. Set CRM_BACKEND_ROOT or pass backend_root param."
        )

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
                    "description": "Docker-only runtime for backend checks (no XAMPP).",
                    "actions": {"list_containers": {}, "run_backend_tests": {}},
                },
            }
        }
