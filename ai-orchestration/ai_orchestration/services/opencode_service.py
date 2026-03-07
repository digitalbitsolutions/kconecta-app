from __future__ import annotations

from .openclaw_service import OpenClawService


class OpenCodeService(OpenClawService):
    """Backward-compatible alias. OpenCode executor now maps to OpenClaw."""
