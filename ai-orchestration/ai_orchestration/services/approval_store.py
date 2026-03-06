from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path


class ApprovalStore:
    def __init__(self, storage_file: Path) -> None:
        self.storage_file = storage_file
        self.storage_file.parent.mkdir(parents=True, exist_ok=True)

    def approve(self, pr_id: str, actor: str) -> dict[str, str]:
        data = self._read()
        record = {
            "approved_at": datetime.now(UTC).isoformat(),
            "actor": actor,
        }
        data[str(pr_id)] = record
        self._write(data)
        return record

    def is_approved(self, pr_id: str) -> bool:
        data = self._read()
        return str(pr_id) in data

    def revoke(self, pr_id: str) -> None:
        data = self._read()
        data.pop(str(pr_id), None)
        self._write(data)

    def _read(self) -> dict[str, dict[str, str]]:
        if not self.storage_file.exists():
            return {}
        content = self.storage_file.read_text(encoding="utf-8").strip()
        if not content:
            return {}
        data = json.loads(content)
        if not isinstance(data, dict):
            return {}
        return {str(key): value for key, value in data.items() if isinstance(value, dict)}

    def _write(self, data: dict[str, dict[str, str]]) -> None:
        self.storage_file.write_text(
            json.dumps(data, indent=2, ensure_ascii=True),
            encoding="utf-8",
        )
