from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass
class CommandResult:
    command: list[str]
    returncode: int
    stdout: str
    stderr: str


class CommandError(RuntimeError):
    def __init__(self, result: CommandResult) -> None:
        command_str = " ".join(result.command)
        message = (
            f"Command failed ({result.returncode}): {command_str}\n"
            f"stdout:\n{result.stdout}\n"
            f"stderr:\n{result.stderr}"
        )
        super().__init__(message)
        self.result = result


class CommandRunner:
    def run(
        self,
        command: list[str],
        cwd: Path | None = None,
        check: bool = True,
        timeout: int = 600,
        env: dict[str, str] | None = None,
    ) -> CommandResult:
        process = subprocess.run(
            command,
            cwd=str(cwd) if cwd else None,
            text=True,
            capture_output=True,
            timeout=timeout,
            env=self._build_env(env),
        )

        result = CommandResult(
            command=command,
            returncode=process.returncode,
            stdout=process.stdout.strip(),
            stderr=process.stderr.strip(),
        )
        if check and result.returncode != 0:
            raise CommandError(result)
        return result

    def _build_env(self, extra: dict[str, str] | None) -> dict[str, str]:
        base = dict(os.environ)
        if extra:
            base.update(extra)
        return base
