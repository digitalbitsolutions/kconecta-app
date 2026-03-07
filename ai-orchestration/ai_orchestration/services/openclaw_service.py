from __future__ import annotations

import os
import shutil
from pathlib import Path

from .command_runner import CommandResult, CommandRunner


class OpenClawService:
    def __init__(self, runner: CommandRunner | None = None) -> None:
        self.runner = runner or CommandRunner()

    def is_available(self) -> bool:
        binary = self._resolve_binary()
        if not binary:
            return False
        capabilities = self._detect_capabilities(binary)
        return capabilities["run"] or capabilities["agent_local"]

    def resolve_command(self) -> list[str]:
        binary = self._resolve_binary()
        if not binary:
            raise RuntimeError(
                "OpenClaw not found in PATH. Install OpenClaw CLI and ensure 'openclaw' is available."
            )
        capabilities = self._detect_capabilities(binary)
        if capabilities["run"]:
            return [binary, "run"]
        if capabilities["agent_local"]:
            return [binary, "agent", "--local", "--message"]
        if not capabilities["run"]:
            raise RuntimeError(
                "Detected OpenClaw CLI does not support known coding command surfaces "
                "('openclaw run' or 'openclaw agent --local --message')."
            )
        return [binary]

    def apply_patch(
        self,
        *,
        worktree: Path,
        prompt: str,
        files: list[str],
    ) -> CommandResult:
        if not files:
            raise ValueError("OpenClaw apply_patch requires at least one file in scope.")

        binary = self._resolve_binary()
        if not binary:
            raise RuntimeError(
                "OpenClaw not found in PATH. Install OpenClaw CLI and ensure 'openclaw' is available."
            )

        capabilities = self._detect_capabilities(binary)
        if capabilities["run"]:
            command = [
                binary,
                "run",
                prompt,
            ]
        elif capabilities["agent_local"]:
            command = [
                binary,
                "agent",
                "--local",
                "--session-id",
                "ai-orchestrator",
                "--message",
                prompt,
                "--json",
            ]
        else:
            raise RuntimeError(
                "Detected OpenClaw CLI does not support known coding command surfaces "
                "('openclaw run' or 'openclaw agent --local --message')."
            )

        previous_workspace = self._get_workspace(binary)
        try:
            self._set_workspace(binary, worktree)
            result = self.runner.run(
                command,
                cwd=worktree,
                check=False,
                timeout=1800,
                env=self._openclaw_env(),
            )
        finally:
            if previous_workspace:
                self._set_workspace(binary, Path(previous_workspace), restore=True)

        if result.returncode != 0:
            raise RuntimeError(
                "OpenClaw execution failed. "
                f"stderr: {result.stderr or '(empty)'}"
            )
        if self._looks_like_execution_failure(result.stdout, result.stderr):
            raise RuntimeError(
                "OpenClaw reported an execution error in output. "
                f"stdout: {result.stdout[:500]}"
            )
        return result

    def _openclaw_env(self) -> dict[str, str]:
        return {
            "PYTHONUTF8": os.environ.get("PYTHONUTF8", "1"),
            # OpenClaw requires a provider credential surface even for local Ollama.
            "OLLAMA_API_KEY": os.environ.get("OLLAMA_API_KEY", "local"),
        }

    def _resolve_binary(self) -> str | None:
        return shutil.which("openclaw")

    def _detect_capabilities(self, binary: str) -> dict[str, bool]:
        return {
            "run": self._supports_run_subcommand(binary),
            "agent_local": self._supports_agent_local(binary),
        }

    def _supports_run_subcommand(self, binary: str) -> bool:
        probe = self.runner.run(
            [binary, "--help"],
            check=False,
            timeout=20,
        )
        if probe.returncode != 0:
            return False
        lines = (probe.stdout + "\n" + probe.stderr).splitlines()
        in_commands = False
        for raw_line in lines:
            stripped = raw_line.strip()
            lower = stripped.lower()
            if lower == "commands:":
                in_commands = True
                continue
            if not in_commands:
                continue
            if lower.startswith("examples:") or lower.startswith("docs:"):
                break
            if not stripped:
                continue

            command_name = stripped.split(maxsplit=1)[0].lower()
            if command_name == "run":
                return True
        return False

    def _supports_agent_local(self, binary: str) -> bool:
        probe = self.runner.run(
            [binary, "agent", "--help"],
            check=False,
            timeout=20,
        )
        if probe.returncode != 0:
            return False
        text = (probe.stdout + "\n" + probe.stderr).lower()
        return "--local" in text and "--message" in text

    def _get_workspace(self, binary: str) -> str | None:
        probe = self.runner.run(
            [binary, "config", "get", "agents.defaults.workspace"],
            check=False,
            timeout=20,
        )
        if probe.returncode != 0:
            return None
        value = probe.stdout.strip()
        return value or None

    def _set_workspace(self, binary: str, workspace: Path, *, restore: bool = False) -> None:
        target = str(workspace)
        result = self.runner.run(
            [binary, "config", "set", "agents.defaults.workspace", target],
            check=False,
            timeout=60,
        )
        if result.returncode != 0:
            action = "restore" if restore else "set"
            raise RuntimeError(
                f"OpenClaw failed to {action} workspace to '{target}'. "
                f"stderr: {result.stderr or '(empty)'}"
            )

    def _looks_like_execution_failure(self, stdout: str, stderr: str) -> bool:
        text = (stdout + "\n" + stderr).lower()
        error_markers = (
            "iserror=true",
            "http 404",
            "[tools] edit failed",
            "action send requires",
            "missing required parameters",
            "message failed",
        )
        return any(marker in text for marker in error_markers)
