from __future__ import annotations

from .base_agent import AgentProfile, BaseAgent


class BackendAgent(BaseAgent):
    profile = AgentProfile(
        key="backend",
        name="BackendAgent",
        responsibilities=[
            "Laravel API development",
            "Database schema and migrations",
            "Service layer implementation",
            "Controller and endpoint delivery",
        ],
        coding_notes=(
            "Focus on Laravel conventions, API contracts, schema safety, and backward compatibility."
        ),
    )
