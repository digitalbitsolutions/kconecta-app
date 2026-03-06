from __future__ import annotations

from .base_agent import AgentProfile, BaseAgent


class QAAgent(BaseAgent):
    profile = AgentProfile(
        key="qa",
        name="QAAgent",
        responsibilities=[
            "Unit and integration test coverage",
            "Security and regression checks",
            "Validation strategy and acceptance mapping",
            "Test automation improvements",
        ],
        coding_notes=(
            "Prioritize deterministic tests, reproducible fixtures, and explicit failure diagnostics."
        ),
    )
