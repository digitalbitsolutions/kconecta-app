from __future__ import annotations

import os
import shutil
import subprocess
import time
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

        normalized_files = self._normalize_scope_files(files)
        prepared_prompt = self._compact_prompt(prompt)

        if self._should_run_batch_mode(normalized_files):
            return self._apply_patch_in_batches(
                worktree=worktree,
                prompt=prepared_prompt,
                files=normalized_files,
                model=model,
            )

        return self._run_with_model_variants(
            worktree=worktree,
            prompt=prepared_prompt,
            files=normalized_files,
            model=model,
        )

    def _apply_patch_in_batches(
        self,
        *,
        worktree: Path,
        prompt: str,
        files: list[str],
        model: str,
    ) -> CommandResult:
        batch_size = self._aider_batch_size()
        batches = [files[index : index + batch_size] for index in range(0, len(files), batch_size)]
        results: list[CommandResult] = []

        for index, batch in enumerate(batches, start=1):
            batch_prompt = self._build_batch_prompt(
                base_prompt=prompt,
                batch=batch,
                batch_index=index,
                total_batches=len(batches),
            )
            result = self._run_with_model_variants(
                worktree=worktree,
                prompt=batch_prompt,
                files=batch,
                model=model,
            )
            results.append(result)

        if not results:
            raise RuntimeError("Aider batch mode produced no execution result.")
        if len(results) == 1:
            return results[0]

        merged_stdout = "\n\n".join(
            f"[batch {idx + 1}/{len(results)}]\n{item.stdout}".strip()
            for idx, item in enumerate(results)
        ).strip()
        merged_stderr = "\n\n".join(
            f"[batch {idx + 1}/{len(results)}]\n{item.stderr}".strip()
            for idx, item in enumerate(results)
            if item.stderr
        ).strip()

        return CommandResult(
            command=results[-1].command,
            returncode=0,
            stdout=merged_stdout,
            stderr=merged_stderr,
        )

    def _run_with_model_variants(
        self,
        *,
        worktree: Path,
        prompt: str,
        files: list[str],
        model: str,
    ) -> CommandResult:
        base_command = self.resolve_command()
        model_variants = self._build_model_variants(model)
        file_args = self._build_file_args(worktree=worktree, files=files)
        last_result: CommandResult | None = None
        per_attempt_timeout = self._aider_timeout_seconds()
        total_timeout_budget = self._aider_total_timeout_seconds(per_attempt_timeout)
        last_timeout: subprocess.TimeoutExpired | None = None
        started_at = time.monotonic()

        for model_name in model_variants:
            elapsed = int(time.monotonic() - started_at)
            remaining_budget = max(0, total_timeout_budget - elapsed)
            if remaining_budget < 60:
                break
            attempt_timeout = min(per_attempt_timeout, remaining_budget)

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
                "--edit-format",
                os.environ.get("AIDER_EDIT_FORMAT", "diff"),
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

            try:
                result = self.runner.run(
                    command,
                    cwd=worktree,
                    check=False,
                    timeout=attempt_timeout,
                    env=self._aider_env(),
                )
            except subprocess.TimeoutExpired as exc:
                last_timeout = exc
                continue

            if self._has_model_resolution_error(result):
                last_result = result
                continue

            if result.returncode == 0:
                return result
            last_result = result

        if last_timeout is not None and last_result is None:
            raise RuntimeError(
                "Aider timed out for all model variants within budget. "
                f"Total budget: {total_timeout_budget}s | "
                f"Last timeout: {int(getattr(last_timeout, 'timeout', 0))}s."
            )

        if last_result is None:
            raise RuntimeError(
                "Aider did not produce a result. "
                "Try increasing AIDER_TOTAL_TIMEOUT_SECONDS or reducing file scope."
            )

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

    def _aider_timeout_seconds(self) -> int:
        raw = os.environ.get("AIDER_EXEC_TIMEOUT_SECONDS", "420").strip()
        try:
            value = int(raw)
        except ValueError:
            return 420
        if value < 60:
            return 60
        return value

    def _aider_total_timeout_seconds(self, per_attempt_timeout: int) -> int:
        raw = os.environ.get("AIDER_TOTAL_TIMEOUT_SECONDS", "").strip()
        if raw:
            try:
                value = int(raw)
            except ValueError:
                value = 0
            if value >= 120:
                return value

        # Default total budget limits long hangs while still allowing retries.
        return max(240, min(900, per_attempt_timeout + 180))

    def _aider_batch_size(self) -> int:
        raw = os.environ.get("AIDER_BATCH_SIZE", "2").strip()
        try:
            value = int(raw)
        except ValueError:
            return 2
        return max(1, min(value, 8))

    def _should_run_batch_mode(self, files: list[str]) -> bool:
        enabled = os.environ.get("AIDER_BATCH_MODE", "true").strip().lower()
        if enabled not in {"1", "true", "yes", "on"}:
            return False
        if self._scope_has_directory_markers(files):
            return False
        return len(files) > self._aider_batch_size()

    def _scope_has_directory_markers(self, files: list[str]) -> bool:
        for raw in files:
            normalized = raw.replace("\\", "/").strip()
            if normalized.endswith("/"):
                return True
        return False

    def _normalize_scope_files(self, files: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for raw in files:
            candidate = raw.replace("\\", "/").strip()
            if not candidate:
                continue
            if candidate in seen:
                continue
            normalized.append(candidate)
            seen.add(candidate)
        return normalized

    def _build_batch_prompt(
        self,
        *,
        base_prompt: str,
        batch: list[str],
        batch_index: int,
        total_batches: int,
    ) -> str:
        batch_scope = "\n".join(f"- {item}" for item in batch)
        return (
            f"{base_prompt}\n\n"
            f"Batch execution {batch_index}/{total_batches}.\n"
            "Only modify files listed below in this batch:\n"
            f"{batch_scope}\n"
        )

    def _compact_prompt(self, prompt: str) -> str:
        max_chars = self._prompt_max_chars()
        if len(prompt) <= max_chars:
            return prompt

        head = max(1200, max_chars - 400)
        tail = max(200, max_chars - head)
        return (
            prompt[:head].rstrip()
            + "\n\n[Prompt truncated for executor latency control]\n\n"
            + prompt[-tail:].lstrip()
        )

    def _prompt_max_chars(self) -> int:
        raw = os.environ.get("AIDER_PROMPT_MAX_CHARS", "3200").strip()
        try:
            value = int(raw)
        except ValueError:
            return 3200
        return max(1200, min(value, 12000))

    def _has_model_resolution_error(self, result: CommandResult) -> bool:
        combined = f"{result.stdout}\n{result.stderr}".lower()
        markers = [
            "litellm.badrequesterror",
            "llm provider not provided",
            "pass in the llm provider",
            "model as e.g. for 'huggingface'",
            "model '",
            "not found",
        ]
        return any(marker in combined for marker in markers)

    def _build_model_variants(self, model: str) -> list[str]:
        normalized = model.strip()
        if "/" in normalized:
            return [normalized]

        return [
            f"ollama_chat/{normalized}",
            f"ollama/{normalized}",
            normalized,
        ]

    def _build_file_args(self, *, worktree: Path, files: list[str]) -> list[str]:
        has_directory_scope = False
        normalized_files: list[str] = []
        for raw in files:
            candidate = raw.replace("\\", "/").strip()
            if not candidate:
                continue
            absolute = (worktree / candidate).resolve()
            if candidate.endswith("/") or absolute.is_dir():
                has_directory_scope = True
            else:
                normalized_files.append(candidate)

        # Aider CLI accepts either a single directory or a list of files.
        # If the scope contains directories, pass repository root and rely on
        # post-apply file-scope validation for safety.
        if has_directory_scope:
            return [str(worktree.resolve())]

        if normalized_files:
            return [str((worktree / item).resolve()) for item in normalized_files]

        return [str(worktree.resolve())]
