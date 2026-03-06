from __future__ import annotations

from pathlib import Path
from typing import Any

from ..models import SkillDefinition, TaskSpec


class SkillService:
    def __init__(self, skills_dir: Path) -> None:
        self.skills_dir = skills_dir
        self.skills_dir.mkdir(parents=True, exist_ok=True)

    def list_skills(self, agent: str | None = None) -> list[SkillDefinition]:
        items: list[SkillDefinition] = []
        for file_path in sorted(self.skills_dir.glob("*.*")):
            if file_path.suffix.lower() not in {".yaml", ".yml", ".json"}:
                continue
            definition = self._load_file(file_path)
            if not definition:
                continue
            if agent and definition.agent != agent.lower():
                continue
            items.append(definition)
        return items

    def resolve_for_task(self, task: TaskSpec) -> list[SkillDefinition]:
        all_skills = {item.id: item for item in self.list_skills()}
        selected: list[SkillDefinition] = []

        default_skill_id = f"{task.agent}-core"
        if default_skill_id in all_skills:
            selected.append(all_skills[default_skill_id])

        requested_ids = task.metadata.get("skills", [])
        if requested_ids and not isinstance(requested_ids, list):
            raise ValueError("Task metadata 'skills' must be a list of skill IDs.")

        for raw in requested_ids:
            skill_id = str(raw).strip()
            if not skill_id:
                continue
            if skill_id not in all_skills:
                raise ValueError(f"Requested skill not found: '{skill_id}'")
            skill = all_skills[skill_id]
            if skill.agent != task.agent:
                raise ValueError(
                    f"Skill '{skill_id}' is for agent '{skill.agent}', expected '{task.agent}'."
                )
            if all(existing.id != skill.id for existing in selected):
                selected.append(skill)
        return selected

    def _load_file(self, file_path: Path) -> SkillDefinition | None:
        raw = self._load_data(file_path)
        if not isinstance(raw, dict):
            return None

        skill_id = str(raw.get("id", "")).strip()
        agent = str(raw.get("agent", "")).strip().lower()
        if not skill_id or not agent:
            return None

        validation_steps = raw.get("validation_steps") or []
        if not isinstance(validation_steps, list):
            validation_steps = []

        return SkillDefinition(
            id=skill_id,
            agent=agent,
            summary=str(raw.get("summary", "")).strip(),
            planning_instructions=str(raw.get("planning_instructions", "")).strip(),
            proposal_instructions=str(raw.get("proposal_instructions", "")).strip(),
            validation_steps=[str(step).strip() for step in validation_steps if str(step).strip()],
        )

    def _load_data(self, file_path: Path) -> Any:
        suffix = file_path.suffix.lower()
        text = file_path.read_text(encoding="utf-8")
        if suffix == ".json":
            import json

            return json.loads(text)

        if suffix in {".yaml", ".yml"}:
            try:
                import yaml  # type: ignore
            except ModuleNotFoundError as exc:
                raise RuntimeError(
                    "YAML skill files require PyYAML. "
                    "Run: py -m pip install -r ai-orchestration/requirements.txt"
                ) from exc
            return yaml.safe_load(text)  # type: ignore[attr-defined]

        return None
