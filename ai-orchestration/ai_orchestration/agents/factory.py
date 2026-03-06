from __future__ import annotations

from ..services.llm_router import LlmRouter
from .architect_agent import ArchitectAgent
from .backend_agent import BackendAgent
from .devops_agent import DevOpsAgent
from .mobile_agent import MobileAgent
from .qa_agent import QAAgent


def create_agent(agent_name: str, llm_router: LlmRouter):
    normalized = agent_name.strip().lower()
    mapping = {
        "architect": ArchitectAgent,
        "backend": BackendAgent,
        "mobile": MobileAgent,
        "qa": QAAgent,
        "devops": DevOpsAgent,
    }
    if normalized not in mapping:
        raise ValueError(f"Unknown agent '{agent_name}'.")
    return mapping[normalized](llm_router=llm_router)
