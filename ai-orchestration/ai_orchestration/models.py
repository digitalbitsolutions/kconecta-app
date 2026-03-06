from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .constants import SEMANTIC_COMMIT_PREFIXES, SUPPORTED_LLM_PROVIDERS


@dataclass
class TaskSpec:
    id: str
    title: str
    description: str
    agent: str
    priority: str = "medium"
    files_scope: list[str] = field(default_factory=list)
    acceptance_criteria: list[str] = field(default_factory=list)
    commit_type: str = "feat"
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "TaskSpec":
        required_keys = ("id", "title", "description", "agent")
        missing = [key for key in required_keys if not payload.get(key)]
        if missing:
            raise ValueError(f"Missing required task fields: {', '.join(missing)}")

        commit_type = str(payload.get("commit_type", "feat")).strip().lower()
        if commit_type not in SEMANTIC_COMMIT_PREFIXES:
            raise ValueError(
                "Invalid commit_type. Expected one of: "
                + ", ".join(SEMANTIC_COMMIT_PREFIXES)
            )

        files_scope = payload.get("files_scope") or []
        if not isinstance(files_scope, list):
            raise ValueError("files_scope must be an array of file paths.")

        acceptance_criteria = payload.get("acceptance_criteria") or []
        if not isinstance(acceptance_criteria, list):
            raise ValueError("acceptance_criteria must be an array.")

        metadata = payload.get("metadata") or {}
        if not isinstance(metadata, dict):
            raise ValueError("metadata must be an object.")

        llm_provider = str(metadata.get("llm_provider", "")).strip().lower()
        if llm_provider and llm_provider not in SUPPORTED_LLM_PROVIDERS:
            raise ValueError(
                "metadata.llm_provider must be one of: "
                + ", ".join(SUPPORTED_LLM_PROVIDERS)
            )

        return cls(
            id=str(payload["id"]).strip(),
            title=str(payload["title"]).strip(),
            description=str(payload["description"]).strip(),
            agent=str(payload["agent"]).strip().lower(),
            priority=str(payload.get("priority", "medium")).strip().lower(),
            files_scope=[str(path).strip() for path in files_scope if str(path).strip()],
            acceptance_criteria=[
                str(item).strip() for item in acceptance_criteria if str(item).strip()
            ],
            commit_type=commit_type,
            metadata=metadata,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "agent": self.agent,
            "priority": self.priority,
            "files_scope": self.files_scope,
            "acceptance_criteria": self.acceptance_criteria,
            "commit_type": self.commit_type,
            "metadata": self.metadata,
        }


@dataclass
class SkillDefinition:
    id: str
    agent: str
    summary: str = ""
    planning_instructions: str = ""
    proposal_instructions: str = ""
    validation_steps: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "agent": self.agent,
            "summary": self.summary,
            "planning_instructions": self.planning_instructions,
            "proposal_instructions": self.proposal_instructions,
            "validation_steps": self.validation_steps,
        }


@dataclass
class RagSnippet:
    path: str
    score: float
    excerpt: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "path": self.path,
            "score": self.score,
            "excerpt": self.excerpt,
        }


@dataclass
class McpInvocationResult:
    server: str
    action: str
    params: dict[str, Any] = field(default_factory=dict)
    result: Any = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "server": self.server,
            "action": self.action,
            "params": self.params,
            "result": self.result,
        }


@dataclass
class AgentExecutionContext:
    skills: list[SkillDefinition] = field(default_factory=list)
    rag_snippets: list[RagSnippet] = field(default_factory=list)
    mcp_results: list[McpInvocationResult] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "skills": [item.to_dict() for item in self.skills],
            "rag_snippets": [item.to_dict() for item in self.rag_snippets],
            "mcp_results": [item.to_dict() for item in self.mcp_results],
        }


@dataclass
class AgentOutput:
    plan_summary: str
    proposed_changes: str
    review_notes: str = ""
    target_files: list[str] = field(default_factory=list)
    validation_steps: list[str] = field(default_factory=list)
    commit_message: str = ""
    model_trace: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "plan_summary": self.plan_summary,
            "proposed_changes": self.proposed_changes,
            "review_notes": self.review_notes,
            "target_files": self.target_files,
            "validation_steps": self.validation_steps,
            "commit_message": self.commit_message,
            "model_trace": self.model_trace,
        }
