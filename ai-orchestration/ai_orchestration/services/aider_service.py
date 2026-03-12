from __future__ import annotations

import os
import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

from .command_runner import CommandResult, CommandRunner


@dataclass(frozen=True)
class AiderAgentPolicy:
    prompt_max_chars: int
    batch_size: int
    per_attempt_timeout: int
    total_timeout: int
    retries: int

    def to_dict(self) -> dict[str, int]:
        return {
            "prompt_max_chars": self.prompt_max_chars,
            "batch_size": self.batch_size,
            "per_attempt_timeout": self.per_attempt_timeout,
            "total_timeout": self.total_timeout,
            "retries": self.retries,
        }


DEFAULT_POLICY = AiderAgentPolicy(
    prompt_max_chars=3200,
    batch_size=2,
    per_attempt_timeout=420,
    total_timeout=900,
    retries=1,
)

AGENT_POLICY_DEFAULTS: dict[str, AiderAgentPolicy] = {
    "architect": AiderAgentPolicy(
        prompt_max_chars=2600,
        batch_size=1,
        per_attempt_timeout=360,
        total_timeout=900,
        retries=1,
    ),
    "backend": AiderAgentPolicy(
        prompt_max_chars=3200,
        batch_size=2,
        per_attempt_timeout=540,
        total_timeout=1500,
        retries=2,
    ),
    "mobile": AiderAgentPolicy(
        prompt_max_chars=2200,
        batch_size=1,
        per_attempt_timeout=240,
        total_timeout=1080,
        retries=1,
    ),
    "qa": AiderAgentPolicy(
        prompt_max_chars=2600,
        batch_size=3,
        per_attempt_timeout=360,
        total_timeout=1080,
        retries=1,
    ),
    "devops": AiderAgentPolicy(
        prompt_max_chars=3000,
        batch_size=2,
        per_attempt_timeout=420,
        total_timeout=1200,
        retries=2,
    ),
}


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

    def preview_policy(self, agent_name: str | None = None) -> dict[str, int]:
        return self._resolve_policy(agent_name).to_dict()

    def all_policies_preview(self) -> dict[str, dict[str, int]]:
        names = ["default", *AGENT_POLICY_DEFAULTS.keys()]
        payload: dict[str, dict[str, int]] = {}
        for item in names:
            if item == "default":
                payload[item] = self._resolve_policy(None).to_dict()
            else:
                payload[item] = self._resolve_policy(item).to_dict()
        return payload

    def apply_patch(
        self,
        *,
        worktree: Path,
        prompt: str,
        files: list[str],
        model: str,
        agent_name: str | None = None,
    ) -> CommandResult:
        if not files:
            raise ValueError("Aider apply_patch requires at least one file in scope.")

        policy = self._resolve_policy(agent_name)
        normalized_files = self._normalize_scope_files(files)
        edit_format = self._resolve_edit_format(
            env_key="AIDER_EDIT_FORMAT",
            fallback="diff",
        )
        try:
            return self._apply_with_policy(
                worktree=worktree,
                prompt=prompt,
                files=normalized_files,
                model=model,
                policy=policy,
                agent_name=agent_name,
                edit_format=edit_format,
            )
        except RuntimeError as exc:
            if not self._timeout_recovery_enabled() or not self._is_timeout_error(exc):
                raise

            recovery_policy = self._build_timeout_recovery_policy(policy)
            recovery_edit_format = self._resolve_edit_format(
                env_key="AIDER_TIMEOUT_RECOVERY_EDIT_FORMAT",
                fallback="whole",
            )
            try:
                return self._apply_with_policy(
                    worktree=worktree,
                    prompt=prompt,
                    files=normalized_files,
                    model=model,
                    policy=recovery_policy,
                    agent_name=agent_name,
                    edit_format=recovery_edit_format,
                    force_batch_mode=True,
                )
            except RuntimeError as recovery_exc:
                raise RuntimeError(
                    f"{exc} | Timeout recovery failed: {recovery_exc}"
                ) from recovery_exc

    def _apply_with_policy(
        self,
        *,
        worktree: Path,
        prompt: str,
        files: list[str],
        model: str,
        policy: AiderAgentPolicy,
        agent_name: str | None,
        edit_format: str,
        force_batch_mode: bool = False,
    ) -> CommandResult:
        prepared_prompt = self._compact_prompt(prompt, max_chars=policy.prompt_max_chars)
        partitions = self._partition_files_for_batches(
            files,
            batch_size=policy.batch_size,
        )

        if (force_batch_mode or self._batch_mode_enabled()) and len(partitions) > 1:
            return self._apply_patch_in_batches(
                worktree=worktree,
                prompt=prepared_prompt,
                partitions=partitions,
                model=model,
                policy=policy,
                agent_name=agent_name,
                edit_format=edit_format,
            )

        return self._run_with_model_variants(
            worktree=worktree,
            prompt=prepared_prompt,
            files=files,
            model=model,
            policy=policy,
            agent_name=agent_name,
            edit_format=edit_format,
        )

    def _apply_patch_in_batches(
        self,
        *,
        worktree: Path,
        prompt: str,
        partitions: list[list[str]],
        model: str,
        policy: AiderAgentPolicy,
        agent_name: str | None,
        edit_format: str,
    ) -> CommandResult:
        results: list[CommandResult] = []

        for index, batch in enumerate(partitions, start=1):
            batch_prompt = self._build_batch_prompt(
                base_prompt=prompt,
                batch=batch,
                batch_index=index,
                total_batches=len(partitions),
            )
            result = self._run_with_model_variants(
                worktree=worktree,
                prompt=batch_prompt,
                files=batch,
                model=model,
                policy=policy,
                agent_name=agent_name,
                edit_format=edit_format,
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
        policy: AiderAgentPolicy,
        agent_name: str | None,
        edit_format: str,
    ) -> CommandResult:
        base_command = self.resolve_command()
        model_variants = self._build_model_variants(model)
        file_args = self._build_file_args(worktree=worktree, files=files)
        last_result: CommandResult | None = None
        max_attempts_per_model = max(1, policy.retries + 1)
        last_timeout: subprocess.TimeoutExpired | None = None
        started_at = time.monotonic()
        retry_step = self._retry_timeout_step_seconds()

        for model_name in model_variants:
            for attempt in range(1, max_attempts_per_model + 1):
                elapsed = int(time.monotonic() - started_at)
                remaining_budget = max(0, policy.total_timeout - elapsed)
                if remaining_budget < 60:
                    break

                adaptive_timeout = policy.per_attempt_timeout + ((attempt - 1) * retry_step)
                attempt_timeout = min(adaptive_timeout, remaining_budget)

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
                    edit_format,
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
                    break

                if result.returncode == 0:
                    return result
                last_result = result

        if last_timeout is not None and last_result is None:
            raise RuntimeError(
                "Aider timed out for all model variants within budget. "
                f"Agent: {self._normalize_agent(agent_name) or 'default'} | "
                f"Total budget: {policy.total_timeout}s | "
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

    def _timeout_recovery_enabled(self) -> bool:
        raw = os.environ.get("AIDER_TIMEOUT_RECOVERY", "true").strip().lower()
        return raw in {"1", "true", "yes", "on"}

    def _is_timeout_error(self, exc: RuntimeError) -> bool:
        return "timed out" in str(exc).lower()

    def _build_timeout_recovery_policy(self, policy: AiderAgentPolicy) -> AiderAgentPolicy:
        prompt_max_chars = self._read_int_env(
            "AIDER_TIMEOUT_RECOVERY_PROMPT_MAX_CHARS",
            default=min(policy.prompt_max_chars, 1600),
            minimum=800,
            maximum=6000,
        )
        per_attempt_timeout = self._read_int_env(
            "AIDER_TIMEOUT_RECOVERY_EXEC_TIMEOUT_SECONDS",
            default=max(120, min(policy.per_attempt_timeout, 240)),
            minimum=60,
            maximum=1800,
        )
        total_timeout = self._read_int_env(
            "AIDER_TIMEOUT_RECOVERY_TOTAL_TIMEOUT_SECONDS",
            default=max(per_attempt_timeout + 120, min(policy.total_timeout + 180, 1800)),
            minimum=120,
            maximum=7200,
        )
        retries = self._read_int_env(
            "AIDER_TIMEOUT_RECOVERY_RETRIES",
            default=max(1, min(policy.retries, 1)),
            minimum=0,
            maximum=6,
        )

        if total_timeout < per_attempt_timeout:
            total_timeout = min(7200, per_attempt_timeout + 60)

        return AiderAgentPolicy(
            prompt_max_chars=prompt_max_chars,
            batch_size=1,
            per_attempt_timeout=per_attempt_timeout,
            total_timeout=total_timeout,
            retries=retries,
        )

    def _resolve_edit_format(self, *, env_key: str, fallback: str) -> str:
        raw = os.environ.get(env_key, "").strip().lower()
        if raw in {"diff", "whole"}:
            return raw
        return fallback

    def _aider_env(self) -> dict[str, str]:
        return {
            "AIDER_ANALYTICS": "false",
            "AIDER_DARK_MODE": "false",
            "AIDER_AUTO_COMMITS": "false",
            "OLLAMA_API_BASE": os.environ.get("OLLAMA_API_BASE", "http://127.0.0.1:11434"),
            "PYTHONUTF8": os.environ.get("PYTHONUTF8", "1"),
        }

    def _resolve_policy(self, agent_name: str | None) -> AiderAgentPolicy:
        normalized_agent = self._normalize_agent(agent_name)
        default = AGENT_POLICY_DEFAULTS.get(normalized_agent, DEFAULT_POLICY)

        suffix = normalized_agent.upper() if normalized_agent else ""
        prompt_max_chars = self._resolve_policy_value(
            global_key="AIDER_PROMPT_MAX_CHARS",
            agent_suffix=suffix,
            key_suffix="PROMPT_MAX_CHARS",
            default=default.prompt_max_chars,
            minimum=1200,
            maximum=12000,
        )
        batch_size = self._resolve_policy_value(
            global_key="AIDER_BATCH_SIZE",
            agent_suffix=suffix,
            key_suffix="BATCH_SIZE",
            default=default.batch_size,
            minimum=1,
            maximum=8,
        )
        per_attempt_timeout = self._resolve_policy_value(
            global_key="AIDER_EXEC_TIMEOUT_SECONDS",
            agent_suffix=suffix,
            key_suffix="EXEC_TIMEOUT_SECONDS",
            default=default.per_attempt_timeout,
            minimum=60,
            maximum=3600,
        )
        total_timeout = self._resolve_policy_value(
            global_key="AIDER_TOTAL_TIMEOUT_SECONDS",
            agent_suffix=suffix,
            key_suffix="TOTAL_TIMEOUT_SECONDS",
            default=default.total_timeout,
            minimum=120,
            maximum=7200,
        )
        retries = self._resolve_policy_value(
            global_key="AIDER_RETRIES",
            agent_suffix=suffix,
            key_suffix="RETRIES",
            default=default.retries,
            minimum=0,
            maximum=8,
        )

        if total_timeout < per_attempt_timeout:
            total_timeout = min(7200, per_attempt_timeout + 60)

        return AiderAgentPolicy(
            prompt_max_chars=prompt_max_chars,
            batch_size=batch_size,
            per_attempt_timeout=per_attempt_timeout,
            total_timeout=total_timeout,
            retries=retries,
        )

    def _resolve_policy_value(
        self,
        *,
        global_key: str,
        agent_suffix: str,
        key_suffix: str,
        default: int,
        minimum: int,
        maximum: int,
    ) -> int:
        value = self._read_int_env(global_key, default=default, minimum=minimum, maximum=maximum)
        if agent_suffix:
            per_agent_key = f"AIDER_AGENT_{agent_suffix}_{key_suffix}"
            value = self._read_int_env(
                per_agent_key,
                default=value,
                minimum=minimum,
                maximum=maximum,
            )
        return value

    def _read_int_env(self, key: str, *, default: int, minimum: int, maximum: int) -> int:
        raw = os.environ.get(key, "").strip()
        if not raw:
            return default
        try:
            value = int(raw)
        except ValueError:
            return default
        return max(minimum, min(value, maximum))

    def _retry_timeout_step_seconds(self) -> int:
        return self._read_int_env(
            "AIDER_RETRY_TIMEOUT_STEP_SECONDS",
            default=45,
            minimum=10,
            maximum=600,
        )

    def _batch_mode_enabled(self) -> bool:
        enabled = os.environ.get("AIDER_BATCH_MODE", "true").strip().lower()
        return enabled in {"1", "true", "yes", "on"}

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

    def _partition_files_for_batches(self, files: list[str], *, batch_size: int) -> list[list[str]]:
        if not files:
            return []
        if self._scope_has_directory_markers(files):
            return [files]
        if len(files) <= batch_size:
            return [files]

        groups: dict[str, list[str]] = {}
        order: list[str] = []
        for item in files:
            key = self._scope_group_key(item)
            if key not in groups:
                groups[key] = []
                order.append(key)
            groups[key].append(item)

        flattened: list[str] = []
        for key in order:
            flattened.extend(groups[key])

        return [
            flattened[index : index + batch_size]
            for index in range(0, len(flattened), batch_size)
        ]

    def _scope_group_key(self, file_path: str) -> str:
        parts = [part for part in file_path.replace("\\", "/").split("/") if part]
        if not parts:
            return ""
        if len(parts) >= 2:
            return "/".join(parts[:2])
        return parts[0]

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

    def _compact_prompt(self, prompt: str, *, max_chars: int) -> str:
        compact = self._compact_known_prompt_shape(prompt)
        if len(compact) <= max_chars:
            return compact

        marker = "\n\n[Prompt truncated for executor latency control]"
        keep = max(600, max_chars - len(marker))
        return compact[:keep].rstrip() + marker

    def _compact_known_prompt_shape(self, prompt: str) -> str:
        lines = [line.strip() for line in prompt.replace("\r", "").split("\n") if line.strip()]
        if not lines:
            return prompt.strip()

        section_limits = {
            "Allowed file scope:": 8,
            "Acceptance criteria:": 6,
            "Validation checks:": 6,
            "Constraints:": 6,
            "Implementation intent:": 5,
        }
        important_prefixes = ("Edit files directly", "Task:", "Goal:")
        counts: dict[str, int] = {}
        current_section: str | None = None
        compact_lines: list[str] = []

        for line in lines:
            if line in section_limits:
                current_section = line
                counts.setdefault(current_section, 0)
                compact_lines.append(line)
                continue

            if line.startswith(important_prefixes):
                compact_lines.append(self._clip_line(line, max_chars=220))
                current_section = None
                continue

            if current_section:
                current_count = counts.get(current_section, 0)
                if current_count < section_limits[current_section]:
                    compact_lines.append(self._clip_line(line, max_chars=200))
                counts[current_section] = current_count + 1
                continue

            if len(compact_lines) < 18:
                compact_lines.append(self._clip_line(line, max_chars=200))

        return "\n".join(compact_lines)

    def _clip_line(self, value: str, *, max_chars: int) -> str:
        normalized = " ".join(value.split())
        if len(normalized) <= max_chars:
            return normalized
        return normalized[: max_chars - 3] + "..."

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

    def _normalize_agent(self, agent_name: str | None) -> str:
        if not agent_name:
            return ""
        normalized = agent_name.strip().lower()
        return normalized if normalized in AGENT_POLICY_DEFAULTS else ""
