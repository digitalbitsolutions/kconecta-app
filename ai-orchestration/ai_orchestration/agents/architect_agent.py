from __future__ import annotations

from .base_agent import AgentProfile, BaseAgent


class ArchitectAgent(BaseAgent):
    profile = AgentProfile(
        key="architect",
        name="ArchitectAgent",
        responsibilities=[
            "System architecture design",
            "API design and interface boundaries",
            "Module decomposition and domain mapping",
            "Roadmap and sequencing guidance",
        ],
        coding_notes=(
            "Prioritize architecture docs, contracts, design records, and implementation plans."
        ),
    )
