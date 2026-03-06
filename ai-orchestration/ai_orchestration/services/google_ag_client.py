from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from ..constants import DEFAULT_GOOGLE_AG_BASE_URL, EXTERNAL_MODEL_ROUTING


class GoogleAgClient:
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
            or os.environ.get("GOOGLE_AG_BASE_URL")
            or DEFAULT_GOOGLE_AG_BASE_URL
        ).rstrip("/")
        self.api_key = (api_key or os.environ.get("GOOGLE_AG_API_KEY") or "").strip()
        self.default_model = (
            default_model
            or os.environ.get("GOOGLE_AG_MODEL")
            or EXTERNAL_MODEL_ROUTING["google_ag"]
        ).strip()
        self.timeout_seconds = timeout_seconds

    def is_configured(self) -> bool:
        return self.api_key != ""

    def configuration_status(self) -> dict[str, Any]:
        return {
            "provider": "google_ag",
            "configured": self.is_configured(),
            "base_url": self.base_url,
            "default_model": self.default_model,
            "missing_env": [] if self.is_configured() else ["GOOGLE_AG_API_KEY"],
        }

    def health_check(self) -> bool:
        return self.diagnose()["healthy"]

    def diagnose(self) -> dict[str, Any]:
        status = self.configuration_status()
        if not status["configured"]:
            return {
                **status,
                "healthy": False,
                "error": "Missing GOOGLE_AG_API_KEY.",
            }
        if not self.is_configured():
            return {
                **status,
                "healthy": False,
                "error": "Missing GOOGLE_AG_API_KEY.",
            }
        try:
            path = "/models?key=" + urllib.parse.quote(self.api_key, safe="")
            self._request("GET", path)
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
            raise RuntimeError("Google AG is not configured. Set GOOGLE_AG_API_KEY.")

        model_name = (model or self.default_model).strip()
        if model_name == "":
            raise RuntimeError("Google AG model is empty.")

        body: dict[str, Any] = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ],
            "generationConfig": {"temperature": 0},
        }
        if system:
            body["systemInstruction"] = {
                "parts": [{"text": system}],
            }

        escaped_model = urllib.parse.quote(model_name, safe=".-_")
        key = urllib.parse.quote(self.api_key, safe="")
        response = self._request(
            "POST",
            f"/models/{escaped_model}:generateContent?key={key}",
            body,
        )
        return self._extract_text(response)

    def _extract_text(self, payload: dict[str, Any]) -> str:
        candidates = payload.get("candidates", [])
        if not isinstance(candidates, list):
            return ""
        if not candidates:
            return ""
        first = candidates[0]
        if not isinstance(first, dict):
            return ""
        content = first.get("content", {})
        if not isinstance(content, dict):
            return ""
        parts = content.get("parts", [])
        if not isinstance(parts, list):
            return ""

        chunks: list[str] = []
        for part in parts:
            if not isinstance(part, dict):
                continue
            text = part.get("text")
            if isinstance(text, str) and text.strip():
                chunks.append(text.strip())
        return "\n".join(chunks).strip()

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
            raise RuntimeError(f"Google AG HTTP error {exc.code}: {details}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Cannot reach Google AG at {self.base_url}: {exc}") from exc

    def _compact_error(self, error_text: str) -> str:
        normalized = " ".join(error_text.replace("\r", " ").replace("\n", " ").split())
        if len(normalized) > 260:
            return normalized[:260] + "..."
        return normalized
