from __future__ import annotations

import json
import os
import time
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterator

if os.name == "nt":
    import msvcrt
else:
    import fcntl


class ApprovalStore:
    def __init__(self, storage_file: Path) -> None:
        self.storage_file = storage_file
        self.lock_file = self.storage_file.with_suffix(self.storage_file.suffix + ".lock")
        self.storage_file.parent.mkdir(parents=True, exist_ok=True)

    def approve(self, pr_id: str, actor: str) -> dict[str, str]:
        with self._file_lock():
            data = self._read_unlocked()
            record = {
                "approved_at": datetime.now(UTC).isoformat(),
                "actor": actor,
            }
            data[str(pr_id)] = record
            self._write_unlocked(data)
            return record

    def is_approved(self, pr_id: str) -> bool:
        with self._file_lock():
            data = self._read_unlocked()
            return str(pr_id) in data

    def revoke(self, pr_id: str) -> None:
        with self._file_lock():
            data = self._read_unlocked()
            data.pop(str(pr_id), None)
            self._write_unlocked(data)

    def _read_unlocked(self) -> dict[str, dict[str, str]]:
        if not self.storage_file.exists():
            return {}
        content = self.storage_file.read_text(encoding="utf-8").strip()
        if not content:
            return {}
        data = json.loads(content)
        if not isinstance(data, dict):
            return {}
        return {str(key): value for key, value in data.items() if isinstance(value, dict)}

    def _write_unlocked(self, data: dict[str, dict[str, str]]) -> None:
        tmp_file = self.storage_file.with_suffix(self.storage_file.suffix + ".tmp")
        tmp_file.write_text(json.dumps(data, indent=2, ensure_ascii=True), encoding="utf-8")
        os.replace(tmp_file, self.storage_file)

    @contextmanager
    def _file_lock(self) -> Iterator[None]:
        self.lock_file.parent.mkdir(parents=True, exist_ok=True)
        with self.lock_file.open("a+b") as handle:
            self._acquire_lock(handle)
            try:
                yield
            finally:
                self._release_lock(handle)

    def _acquire_lock(self, handle: Any) -> None:
        if os.name == "nt":
            while True:
                try:
                    handle.seek(0)
                    msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                    return
                except OSError:
                    time.sleep(0.05)
        else:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)

    def _release_lock(self, handle: Any) -> None:
        if os.name == "nt":
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
