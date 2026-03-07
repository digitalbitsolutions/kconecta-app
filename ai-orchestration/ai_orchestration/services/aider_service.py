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
        file_args = self._build_file_args(worktree=worktree, files=files)
        last_result: CommandResult | None = None

        for model_name in model_variants:
            command = [
                *base_command,
                "--yes-always",
                "--no-auto-commits",
                "--no-fancy-input",
                "--no-pretty",
                "--no-stream",
                "--no-suggest-shell-commands",
                "--no-show-model-warnings",
                "--no-restore-chat-history",
                "--input-history-file",
                ".aider.orch.input.history",
                "--chat-history-file",
                ".aider.orch.chat.history.md",
                "--model",
                model_name,
                "--message",
                prompt,
                *file_args,
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
            f"Last stdout: {last_result.stdout or '(empty)'} | "
            f"Last stderr: {last_result.stderr or '(empty)'}"
        )

    def _aider_env(self) -> dict[str, str]:
        return {
            "AIDER_ANALYTICS": "false",
            "AIDER_DARK_MODE": "false",
            "AIDER_AUTO_COMMITS": "false",
            "OLLAMA_API_BASE": os.environ.get("OLLAMA_API_BASE", "http://127.0.0.1:11434"),
            "PYTHONUTF8": os.environ.get("PYTHONUTF8", "1"),
        }

    def _build_file_args(self, *, worktree: Path, files: list[str]) -> list[str]:
        has_directory_scope = False
        normalized_files: list[str] = []
        for raw in files:
            candidate = raw.replace("\\", "/").strip()
            if not candidate:
                continue
            absolute = worktree / candidate
            if candidate.endswith("/") or absolute.is_dir():
                has_directory_scope = True
            else:
                normalized_files.append(candidate)

        # Aider CLI accepts either a single directory or a list of files.
        # If the scope contains directories, pass repository root and rely on
        # post-apply file-scope validation for safety.
        if has_directory_scope:
            return ["."]

        if normalized_files:
            return normalized_files

        return ["."]
