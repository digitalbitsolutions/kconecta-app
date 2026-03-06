from __future__ import annotations

from .base_agent import AgentProfile, BaseAgent


class DevOpsAgent(BaseAgent):
    profile = AgentProfile(
        key="devops",
        name="DevOpsAgent",
        responsibilities=[
            "CI/CD pipeline definitions",
            "Docker and environment setup",
            "Deployment safety checks",
            "Operational reliability and observability",
        ],
        coding_notes=(
            "Focus on reproducible environments, secure defaults, and deployment traceability."
        ),
    )
