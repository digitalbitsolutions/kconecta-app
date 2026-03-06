from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

from ..constants import DEFAULT_WINDSURF_BASE_URL, EXTERNAL_MODEL_ROUTING


class WindsurfClient:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        api_key: str | None = None,
        default_model: str | None = None,
        timeout_seconds: int = 120,
    ) -> None:
        self.base_url = (
            base_url
            or os.environ.get("WINDSURF_BASE_URL")
            or DEFAULT_WINDSURF_BASE_URL
        ).rstrip("/")
        self.api_key = (api_key or os.environ.get("WINDSURF_API_KEY") or "").strip()
        self.default_model = (
            default_model
            or os.environ.get("WINDSURF_MODEL")
            or EXTERNAL_MODEL_ROUTING["windsurf"]
        ).strip()
        self.timeout_seconds = timeout_seconds

    def is_configured(self) -> bool:
        return self.api_key != ""

    def configuration_status(self) -> dict[str, Any]:
        return {
            "provider": "windsurf",
            "configured": self.is_configured(),
            "base_url": self.base_url,
            "default_model": self.default_model,
            "missing_env": [] if self.is_configured() else ["WINDSURF_API_KEY"],
        }

    def health_check(self) -> bool:
        return self.diagnose()["healthy"]

    def diagnose(self) -> dict[str, Any]:
        status = self.configuration_status()
        if not status["configured"]:
            return {
                **status,
                "healthy": False,
                "error": "Missing WINDSURF_API_KEY.",
            }
        if not self.is_configured():
            return {
                **status,
                "healthy": False,
                "error": "Missing WINDSURF_API_KEY.",
            }
        try:
            self._request("GET", "/models")
            return {
                **status,
                "healthy": True,
                "error": None,
            }
        except Exception as exc:
            return {
                **status,
                "healthy": False,
                "error": self._compact_error(str(exc)),
            }

    def generate(
        self,
        *,
        prompt: str,
        model: str | None = None,
        system: str | None = None,
    ) -> str:
        if not self.is_configured():
            raise RuntimeError("Windsurf is not configured. Set WINDSURF_API_KEY.")

        model_name = (model or self.default_model).strip()
        if model_name == "":
            raise RuntimeError("Windsurf model is empty.")

        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        body = {
            "model": model_name,
            "temperature": 0,
            "messages": messages,
        }
        response = self._request("POST", "/chat/completions", body)
        return self._extract_text(response)

    def _extract_text(self, payload: dict[str, Any]) -> str:
        choices = payload.get("choices", [])
        if not isinstance(choices, list) or not choices:
            return ""
        first = choices[0]
        if not isinstance(first, dict):
            return ""
        message = first.get("message", {})
        if not isinstance(message, dict):
            return ""

        content = message.get("content", "")
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            chunks: list[str] = []
            for item in content:
                if not isinstance(item, dict):
                    continue
                text = item.get("text")
                if isinstance(text, str) and text.strip():
                    chunks.append(text.strip())
            return "\n".join(chunks).strip()
        return ""

    def _request(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        body = None
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")

        request = urllib.request.Request(url, method=method, data=body, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                raw = response.read().decode("utf-8")
                if not raw:
                    return {}
                parsed = json.loads(raw)
                if isinstance(parsed, dict):
                    return parsed
                return {"items": parsed}
        except urllib.error.HTTPError as exc:
            details = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Windsurf HTTP error {exc.code}: {details}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Cannot reach Windsurf at {self.base_url}: {exc}") from exc

    def _compact_error(self, error_text: str) -> str:
        normalized = " ".join(error_text.replace("\r", " ").replace("\n", " ").split())
        if len(normalized) > 260:
            return normalized[:260] + "..."
        return normalized
