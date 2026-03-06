from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..models import TaskSpec


class TaskService:
    def load(self, task_file: Path) -> TaskSpec:
        if not task_file.exists():
            raise FileNotFoundError(f"Task file does not exist: {task_file}")

        suffix = task_file.suffix.lower()
        if suffix == ".json":
            data = json.loads(task_file.read_text(encoding="utf-8"))
        elif suffix in {".yaml", ".yml"}:
            data = self._load_yaml(task_file)
        else:
            raise ValueError("Task file must be JSON or YAML.")

        if not isinstance(data, dict):
            raise ValueError("Task file root must be an object.")
        return TaskSpec.from_dict(data)

    def _load_yaml(self, task_file: Path) -> dict[str, Any]:
        try:
            import yaml  # type: ignore
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "YAML support requires PyYAML. Run: py -m pip install -r ai-orchestration/requirements.txt"
            ) from exc

        content = yaml.safe_load(task_file.read_text(encoding="utf-8"))  # type: ignore[attr-defined]
        if not isinstance(content, dict):
            raise ValueError("YAML task root must be an object.")
        return content
