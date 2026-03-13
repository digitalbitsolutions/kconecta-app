from __future__ import annotations

import os
import signal
import subprocess
import time
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
        self._enforce_runtime_policy(command)
        popen_kwargs: dict[str, object] = {
            "cwd": str(cwd) if cwd else None,
            "text": True,
            "encoding": "utf-8",
            "errors": "replace",
            "stdout": subprocess.PIPE,
            "stderr": subprocess.PIPE,
            "env": self._build_env(env),
        }
        if os.name == "nt":
            popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            popen_kwargs["start_new_session"] = True

        process = subprocess.Popen(command, **popen_kwargs)
        try:
            stdout, stderr = process.communicate(timeout=timeout)
        except subprocess.TimeoutExpired as exc:
            # Ensure we terminate the full process tree (including model/tool children).
            self._terminate_process_tree(process)
            stdout, stderr = process.communicate()
            raise subprocess.TimeoutExpired(
                cmd=command,
                timeout=timeout,
                output=(stdout or "").strip(),
                stderr=(stderr or "").strip(),
            ) from exc

        result = CommandResult(
            command=command,
            returncode=process.returncode if process.returncode is not None else 1,
            stdout=(stdout or "").strip(),
            stderr=(stderr or "").strip(),
        )
        if check and result.returncode != 0:
            raise CommandError(result)
        return result

    def _terminate_process_tree(self, process: subprocess.Popen[str]) -> None:
        pid = process.pid
        if pid is None:
            return

        try:
            if os.name == "nt":
                subprocess.run(
                    ["taskkill", "/PID", str(pid), "/T", "/F"],
                    check=False,
                    capture_output=True,
                    text=True,
                )
                return

            pgid = os.getpgid(pid)
            os.killpg(pgid, signal.SIGTERM)
            time.sleep(0.5)
            if process.poll() is None:
                os.killpg(pgid, signal.SIGKILL)
        except Exception:
            try:
                process.kill()
            except Exception:
                return

    def _build_env(self, extra: dict[str, str] | None) -> dict[str, str]:
        base = dict(os.environ)
        if extra:
            base.update(extra)
        return base

    def _enforce_runtime_policy(self, command: list[str]) -> None:
        if not command:
            return

        joined = " ".join(command).lower()
        if "xampp" in joined:
            raise RuntimeError(
                "XAMPP usage is blocked by policy. Use Docker-based commands instead."
            )

        # Never allow `php artisan test` on host/shell. It must run in Docker.
        host_artisan_test = "php artisan test" in joined
        dockerized_artisan_test = any(
            token in joined
            for token in (
                "docker compose",
                "docker-compose",
                "docker exec",
                "backend-test-docker",
            )
        )
        if host_artisan_test and not dockerized_artisan_test:
            raise RuntimeError(
                "Direct `php artisan test` on host is blocked by policy. "
                "Use `py ai-orchestration/orchestrator.py backend-test-docker`."
            )

        allow_host_php = os.environ.get("AI_ALLOW_HOST_PHP", "").strip().lower() in {
            "1",
            "true",
            "yes",
            "on",
        }
        executable = Path(command[0]).name.lower()
        if executable in {"php", "php.exe"} and not allow_host_php:
            raise RuntimeError(
                "Host PHP execution is blocked by policy. Use `docker compose exec app php ...` "
                "or `py ai-orchestration/orchestrator.py backend-test-docker`."
            )
