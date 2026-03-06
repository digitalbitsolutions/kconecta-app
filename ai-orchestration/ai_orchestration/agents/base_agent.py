from __future__ import annotations

import json
import re
from dataclasses import dataclass

from ..constants import MODEL_ROUTING
from ..models import AgentExecutionContext, AgentOutput, TaskSpec
from ..services.llm_router import LlmRouter


@dataclass
class AgentProfile:
    key: str
    name: str
    responsibilities: list[str]
    coding_notes: str


class BaseAgent:
    profile: AgentProfile

    def __init__(self, llm_router: LlmRouter) -> None:
        self.llm_router = llm_router

    def execute(
        self,
        task: TaskSpec,
        *,
        context: AgentExecutionContext | None = None,
    ) -> AgentOutput:
        context = context or AgentExecutionContext()
        planning_model = MODEL_ROUTING["planning"]
        coding_model = self._select_coding_model(task)

        planning_prompt = self._planning_prompt(task, context=context)
        plan_summary, planning_route = self.llm_router.generate(
            task=task,
            phase="planning",
            default_model=planning_model,
            prompt=planning_prompt,
            system=self._system_prompt(),
        )

        proposal_prompt = self._proposal_prompt(task, plan_summary, context=context)
        proposal_raw, proposal_route = self.llm_router.generate(
            task=task,
            phase="proposal",
            default_model=coding_model,
            prompt=proposal_prompt,
            system=self._system_prompt(),
        )

        review_prompt = self._review_prompt(task, plan_summary, proposal_raw, context=context)
        review_notes, review_route = self.llm_router.generate(
            task=task,
            phase="review",
            default_model=MODEL_ROUTING["lightweight"],
            prompt=review_prompt,
            system=self._review_system_prompt(),
        )

        return self._normalize_output(
            task,
            plan_summary,
            proposal_raw,
            context=context,
            review_notes=review_notes,
            model_trace={
                "planning": planning_route,
                "proposal": proposal_route,
                "review": review_route,
            },
        )

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

    def _review_system_prompt(self) -> str:
        return (
            "You are a strict code reviewer. "
            "Focus on defects, regressions, readability issues, and missed validation. "
            "Keep output concise and actionable."
        )

    def _planning_prompt(self, task: TaskSpec, *, context: AgentExecutionContext) -> str:
        scope = "\n".join(f"- {item}" for item in task.files_scope) or "- (not provided)"
        acceptance = "\n".join(f"- {item}" for item in task.acceptance_criteria) or "- (not provided)"
        responsibilities = "\n".join(
            f"- {item}" for item in self.profile.responsibilities
        )
        skills_text = self._skills_planning_text(context)
        rag_text = self._rag_text(context)
        mcp_text = self._mcp_text(context)
        return (
            f"Agent: {self.profile.name}\n"
            f"Task ID: {task.id}\n"
            f"Title: {task.title}\n"
            f"Description: {task.description}\n"
            f"Priority: {task.priority}\n"
            f"Agent responsibilities:\n{responsibilities}\n"
            f"File scope:\n{scope}\n"
            f"Acceptance criteria:\n{acceptance}\n\n"
            f"Skill guidance:\n{skills_text}\n\n"
            f"RAG context:\n{rag_text}\n\n"
            f"MCP observations:\n{mcp_text}\n\n"
            "Generate an implementation plan with:\n"
            "1) architecture intent\n"
            "2) concrete change list\n"
            "3) validation list\n"
            "Keep the response short and precise."
        )

    def _proposal_prompt(
        self,
        task: TaskSpec,
        plan_summary: str,
        *,
        context: AgentExecutionContext,
    ) -> str:
        scope = "\n".join(f"- {item}" for item in task.files_scope) or "- (not provided)"
        acceptance = "\n".join(f"- {item}" for item in task.acceptance_criteria) or "- (not provided)"
        skills_text = self._skills_proposal_text(context)
        rag_text = self._rag_text(context)
        mcp_text = self._mcp_text(context)
        return (
            f"Plan summary:\n{plan_summary}\n\n"
            f"Task title: {task.title}\n"
            f"Task description: {task.description}\n"
            f"Coding notes: {self.profile.coding_notes}\n"
            f"File scope:\n{scope}\n"
            f"Acceptance criteria:\n{acceptance}\n\n"
            f"Skill guidance:\n{skills_text}\n\n"
            f"RAG context:\n{rag_text}\n\n"
            f"MCP observations:\n{mcp_text}\n\n"
            "Return a strict JSON object with keys:\n"
            "plan_summary (string),\n"
            "proposed_changes (string),\n"
            "target_files (array of strings),\n"
            "validation_steps (array of strings),\n"
            "commit_message (string).\n"
            "Commit message must start with one of: feat:, fix:, refactor:, test:, docs:.\n"
            "Do not include markdown fences."
        )

    def _review_prompt(
        self,
        task: TaskSpec,
        plan_summary: str,
        proposal_raw: str,
        *,
        context: AgentExecutionContext,
    ) -> str:
        acceptance = "\n".join(f"- {item}" for item in task.acceptance_criteria) or "- (not provided)"
        proposal_excerpt = self._compact_text(proposal_raw, limit=2800)
        skills_text = self._skills_proposal_text(context)
        return (
            f"Task: {task.id} - {task.title}\n"
            f"Plan summary:\n{self._compact_text(plan_summary, limit=1200)}\n\n"
            f"Acceptance criteria:\n{acceptance}\n\n"
            f"Skill guidance:\n{skills_text}\n\n"
            "Review the proposed implementation and return concise notes with:\n"
            "1) potential bugs or regressions\n"
            "2) readability/refactor suggestions\n"
            "3) missing tests or validations\n\n"
            f"Proposed implementation (excerpt):\n{proposal_excerpt}\n"
        )

    def _normalize_output(
        self,
        task: TaskSpec,
        plan_summary: str,
        proposal_raw: str,
        *,
        context: AgentExecutionContext,
        review_notes: str = "",
        model_trace: dict[str, object] | None = None,
    ) -> AgentOutput:
        fallback_validation = self._merged_validation_steps(task, context=context)
        compact_review_notes = self._compact_text(review_notes, limit=1800)
        payload = self._parse_json_object(proposal_raw)
        if payload:
            commit_message = str(payload.get("commit_message", "")).strip()
            if not commit_message:
                commit_message = f"{task.commit_type}: {task.title}"
            return AgentOutput(
                plan_summary=str(payload.get("plan_summary", plan_summary)).strip(),
                proposed_changes=str(payload.get("proposed_changes", proposal_raw)).strip(),
                review_notes=compact_review_notes,
                target_files=self._sanitize_files(payload.get("target_files"), task.files_scope),
                validation_steps=self._sanitize_steps(
                    payload.get("validation_steps"), fallback_validation
                ),
                commit_message=commit_message,
                model_trace=dict(model_trace or {}),
            )

        return AgentOutput(
            plan_summary=plan_summary.strip(),
            proposed_changes=self._strip_code_fences(proposal_raw),
            review_notes=compact_review_notes,
            target_files=list(task.files_scope),
            validation_steps=fallback_validation,
            commit_message=f"{task.commit_type}: {task.title}",
            model_trace=dict(model_trace or {}),
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

    def _compact_text(self, raw: str, *, limit: int) -> str:
        normalized = " ".join(raw.replace("\r", " ").replace("\n", " ").split())
        if len(normalized) <= limit:
            return normalized
        return normalized[:limit] + "..."

    def _merged_validation_steps(
        self,
        task: TaskSpec,
        *,
        context: AgentExecutionContext,
    ) -> list[str]:
        merged: list[str] = list(task.acceptance_criteria)
        for skill in context.skills:
            for step in skill.validation_steps:
                if step and step not in merged:
                    merged.append(step)
        return merged

    def _skills_planning_text(self, context: AgentExecutionContext) -> str:
        chunks: list[str] = []
        for skill in context.skills:
            if skill.planning_instructions:
                chunks.append(f"{skill.id}: {skill.planning_instructions}")
        return "\n".join(f"- {item}" for item in chunks) or "- none"

    def _skills_proposal_text(self, context: AgentExecutionContext) -> str:
        chunks: list[str] = []
        for skill in context.skills:
            if skill.proposal_instructions:
                chunks.append(f"{skill.id}: {skill.proposal_instructions}")
        return "\n".join(f"- {item}" for item in chunks) or "- none"

    def _rag_text(self, context: AgentExecutionContext) -> str:
        lines: list[str] = []
        for item in context.rag_snippets:
            excerpt = item.excerpt.replace("\n", " ").strip()
            lines.append(f"{item.path} (score={item.score}): {excerpt}")
        return "\n".join(f"- {line}" for line in lines) or "- none"

    def _mcp_text(self, context: AgentExecutionContext) -> str:
        lines: list[str] = []
        for item in context.mcp_results:
            result_preview = str(item.result)
            if len(result_preview) > 220:
                result_preview = result_preview[:220] + "..."
            lines.append(f"{item.server}.{item.action}: {result_preview}")
        return "\n".join(f"- {line}" for line in lines) or "- none"
