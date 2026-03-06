from __future__ import annotations

import json
import re
from dataclasses import dataclass

from ..constants import MODEL_ROUTING
from ..models import AgentOutput, TaskSpec
from ..services.ollama_client import OllamaClient


@dataclass
class AgentProfile:
    key: str
    name: str
    responsibilities: list[str]
    coding_notes: str


class BaseAgent:
    profile: AgentProfile

    def __init__(self, ollama: OllamaClient) -> None:
        self.ollama = ollama

    def execute(self, task: TaskSpec) -> AgentOutput:
        planning_model = MODEL_ROUTING["planning"]
        coding_model = self._select_coding_model(task)

        planning_prompt = self._planning_prompt(task)
        plan_summary = self.ollama.generate(
            planning_model,
            planning_prompt,
            system=self._system_prompt(),
        )

        proposal_prompt = self._proposal_prompt(task, plan_summary)
        proposal_raw = self.ollama.generate(
            coding_model,
            proposal_prompt,
            system=self._system_prompt(),
        )

        return self._normalize_output(task, plan_summary, proposal_raw)

    def _select_coding_model(self, task: TaskSpec) -> str:
        if task.priority in {"low", "trivial"}:
            return MODEL_ROUTING["lightweight"]
        return MODEL_ROUTING["coding"]

    def _system_prompt(self) -> str:
        return (
            "You are a deterministic software agent. "
            "Do not use markdown code fences. "
            "Return concise structured outputs only."
        )

    def _planning_prompt(self, task: TaskSpec) -> str:
        scope = "\n".join(f"- {item}" for item in task.files_scope) or "- (not provided)"
        acceptance = "\n".join(f"- {item}" for item in task.acceptance_criteria) or "- (not provided)"
        responsibilities = "\n".join(
            f"- {item}" for item in self.profile.responsibilities
        )
        return (
            f"Agent: {self.profile.name}\n"
            f"Task ID: {task.id}\n"
            f"Title: {task.title}\n"
            f"Description: {task.description}\n"
            f"Priority: {task.priority}\n"
            f"Agent responsibilities:\n{responsibilities}\n"
            f"File scope:\n{scope}\n"
            f"Acceptance criteria:\n{acceptance}\n\n"
            "Generate an implementation plan with:\n"
            "1) architecture intent\n"
            "2) concrete change list\n"
            "3) validation list\n"
            "Keep the response short and precise."
        )

    def _proposal_prompt(self, task: TaskSpec, plan_summary: str) -> str:
        scope = "\n".join(f"- {item}" for item in task.files_scope) or "- (not provided)"
        acceptance = "\n".join(f"- {item}" for item in task.acceptance_criteria) or "- (not provided)"
        return (
            f"Plan summary:\n{plan_summary}\n\n"
            f"Task title: {task.title}\n"
            f"Task description: {task.description}\n"
            f"Coding notes: {self.profile.coding_notes}\n"
            f"File scope:\n{scope}\n"
            f"Acceptance criteria:\n{acceptance}\n\n"
            "Return a strict JSON object with keys:\n"
            "plan_summary (string),\n"
            "proposed_changes (string),\n"
            "target_files (array of strings),\n"
            "validation_steps (array of strings),\n"
            "commit_message (string).\n"
            "Commit message must start with one of: feat:, fix:, refactor:, test:, docs:.\n"
            "Do not include markdown fences."
        )

    def _normalize_output(
        self,
        task: TaskSpec,
        plan_summary: str,
        proposal_raw: str,
    ) -> AgentOutput:
        payload = self._parse_json_object(proposal_raw)
        if payload:
            commit_message = str(payload.get("commit_message", "")).strip()
            if not commit_message:
                commit_message = f"{task.commit_type}: {task.title}"
            return AgentOutput(
                plan_summary=str(payload.get("plan_summary", plan_summary)).strip(),
                proposed_changes=str(payload.get("proposed_changes", proposal_raw)).strip(),
                target_files=self._sanitize_files(payload.get("target_files"), task.files_scope),
                validation_steps=self._sanitize_steps(
                    payload.get("validation_steps"), task.acceptance_criteria
                ),
                commit_message=commit_message,
            )

        return AgentOutput(
            plan_summary=plan_summary.strip(),
            proposed_changes=self._strip_code_fences(proposal_raw),
            target_files=list(task.files_scope),
            validation_steps=list(task.acceptance_criteria),
            commit_message=f"{task.commit_type}: {task.title}",
        )

    def _parse_json_object(self, raw: str) -> dict[str, object] | None:
        text = raw.strip()
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            return None
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return None
        return None

    def _sanitize_files(self, data: object, fallback: list[str]) -> list[str]:
        if isinstance(data, list):
            normalized = [str(item).strip() for item in data if str(item).strip()]
            if normalized:
                return normalized
        return list(fallback)

    def _sanitize_steps(self, data: object, fallback: list[str]) -> list[str]:
        if isinstance(data, list):
            normalized = [str(item).strip() for item in data if str(item).strip()]
            if normalized:
                return normalized
        return list(fallback)

    def _strip_code_fences(self, raw: str) -> str:
        text = raw.strip()
        text = re.sub(r"^```(?:json|text)?", "", text)
        text = re.sub(r"```$", "", text)
        return text.strip()
