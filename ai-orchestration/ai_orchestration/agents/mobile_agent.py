from __future__ import annotations

from .base_agent import AgentProfile, BaseAgent


class MobileAgent(BaseAgent):
    profile = AgentProfile(
        key="mobile",
        name="MobileAgent",
        responsibilities=[
            "React Native with TypeScript scaffolding",
            "Mobile module composition",
            "Navigation and state boundaries",
            "API integration contracts for mobile clients",
        ],
        coding_notes=(
            "Default mobile stack is React Native with TypeScript. "
            "Prefer deterministic scaffold steps and minimal boilerplate."
        ),
    )
