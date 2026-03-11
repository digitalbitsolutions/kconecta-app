from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from ..constants import DEFAULT_EXECUTOR, SUPPORTED_EXECUTORS
from .aider_service import AiderService
from .command_runner import CommandResult
from .openclaw_service import OpenClawService


@dataclass
class ExecutorSelection:
    selected: str
    fallback_from: str | None = None
    reason: str = ""


@dataclass
class ExecutorRunResult:
    selected_executor: str
    command: list[str]
    stdout: str
    stderr: str
    fallback_from: str | None = None
    fallback_reason: str = ""

    @classmethod
    def from_command_result(
        cls,
        *,
        executor: str,
        result: CommandResult,
        fallback_from: str | None = None,
        fallback_reason: str = "",
    ) -> "ExecutorRunResult":
        return cls(
            selected_executor=executor,
            command=result.command,
            stdout=result.stdout,
            stderr=result.stderr,
            fallback_from=fallback_from,
            fallback_reason=fallback_reason,
        )


class ExecutorService:
    def __init__(
        self,
        *,
        aider: AiderService,
        openclaw: OpenClawService,
    ) -> None:
        self.aider = aider
        self.openclaw = openclaw

    def availability(self) -> dict[str, object]:
        openclaw_available = self._is_openclaw_available()
        return {
            "openclaw_available": openclaw_available,
            # Backward-compatible diagnostics key.
            "opencode_available": openclaw_available,
            "aider_available": self._is_aider_available(),
            "selected_executor": self._select_executor().selected,
        }

    def apply_patch(
        self,
        *,
        worktree: Path,
        prompt: str,
        files: list[str],
        model: str,
        agent_name: str | None = None,
    ) -> ExecutorRunResult:
        selection = self._select_executor()
        selected = selection.selected

        if selected == "openclaw":
            try:
                result = self.openclaw.apply_patch(
                    worktree=worktree,
                    prompt=prompt,
                    files=files,
                )
                return ExecutorRunResult.from_command_result(
                    executor="openclaw",
                    result=result,
                    fallback_from=selection.fallback_from,
                    fallback_reason=selection.reason,
                )
            except Exception as exc:
                if self._is_aider_available():
                    fallback_result = self.aider.apply_patch(
                        worktree=worktree,
                        prompt=prompt,
                        files=files,
                        model=model,
                        agent_name=agent_name,
                    )
                    return ExecutorRunResult.from_command_result(
                        executor="aider",
                        result=fallback_result,
                        fallback_from="openclaw",
                        fallback_reason=str(exc),
                    )
                raise

        result = self.aider.apply_patch(
            worktree=worktree,
            prompt=prompt,
            files=files,
            model=model,
            agent_name=agent_name,
        )
        return ExecutorRunResult.from_command_result(
            executor="aider",
            result=result,
            fallback_from=selection.fallback_from,
            fallback_reason=selection.reason,
        )

    def _select_executor(self) -> ExecutorSelection:
        raw = os.environ.get("AI_EXECUTOR", DEFAULT_EXECUTOR).strip().lower()
        if raw not in SUPPORTED_EXECUTORS:
            raw = DEFAULT_EXECUTOR

        requested = raw
        if raw == "opencode":
            raw = "openclaw"

        openclaw_ok = self._is_openclaw_available()
        aider_ok = self._is_aider_available()

        if raw == "openclaw":
            if openclaw_ok:
                if requested == "opencode":
                    return ExecutorSelection(
                        selected="openclaw",
                        fallback_from="opencode",
                        reason="opencode is a compatibility alias for openclaw.",
                    )
                return ExecutorSelection(selected="openclaw")
            if aider_ok:
                return ExecutorSelection(
                    selected="aider",
                    fallback_from=requested,
                    reason="OpenClaw CLI not available; fallback to Aider.",
                )
            raise RuntimeError(
                f"AI_EXECUTOR={requested} but OpenClaw is unavailable and no Aider fallback was found."
            )

        if raw == "aider":
            if aider_ok:
                return ExecutorSelection(selected="aider")
            if openclaw_ok:
                return ExecutorSelection(
                    selected="openclaw",
                    fallback_from="aider",
                    reason="Aider not available; fallback to OpenClaw.",
                )
            raise RuntimeError(
                "AI_EXECUTOR=aider but Aider is unavailable and no OpenClaw fallback was found."
            )

        if openclaw_ok:
            return ExecutorSelection(selected="openclaw")
        if aider_ok:
            return ExecutorSelection(
                selected="aider",
                fallback_from="openclaw",
                reason="OpenClaw CLI not available; fallback to Aider.",
            )
        raise RuntimeError("No executor available. Install OpenClaw CLI or Aider.")

    def _is_openclaw_available(self) -> bool:
        return self.openclaw.is_available()

    def _is_aider_available(self) -> bool:
        try:
            self.aider.resolve_command()
            return True
        except Exception:
            return False
