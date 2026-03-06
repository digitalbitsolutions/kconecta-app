from __future__ import annotations

import os
import shutil
from pathlib import Path

from .command_runner import CommandResult, CommandRunner


class AiderService:
    def __init__(self, runner: CommandRunner | None = None) -> None:
        self.runner = runner or CommandRunner()

    def resolve_command(self) -> list[str]:
        aider_path = shutil.which("aider")
        if aider_path:
            return [aider_path]

        probe = self.runner.run(
            ["py", "-m", "aider.main", "--version"],
            check=False,
        )
        if probe.returncode == 0:
            return ["py", "-m", "aider.main"]

        raise RuntimeError(
            "Aider not found in PATH and 'py -m aider.main' is unavailable. "
            "Install aider-chat or expose aider executable in PATH."
        )

    def apply_patch(
        self,
        *,
        worktree: Path,
        prompt: str,
        files: list[str],
        model: str,
    ) -> CommandResult:
        if not files:
            raise ValueError("Aider apply_patch requires at least one file in scope.")

        base_command = self.resolve_command()
        model_variants = [f"ollama_chat/{model}", f"ollama/{model}", model]
        last_result: CommandResult | None = None

        for model_name in model_variants:
            command = [
                *base_command,
                "--yes-always",
                "--no-auto-commits",
                "--model",
                model_name,
                "--message",
                prompt,
                *files,
            ]

            result = self.runner.run(
                command,
                cwd=worktree,
                check=False,
                timeout=1800,
                env=self._aider_env(),
            )
            if result.returncode == 0:
                return result
            last_result = result

        assert last_result is not None
        raise RuntimeError(
            "Aider failed for all model variants. "
            f"Last stderr: {last_result.stderr or '(empty)'}"
        )

    def _aider_env(self) -> dict[str, str]:
        return {
            "AIDER_ANALYTICS": "false",
            "AIDER_DARK_MODE": "false",
            "AIDER_AUTO_COMMITS": "false",
            "PYTHONUTF8": os.environ.get("PYTHONUTF8", "1"),
        }
