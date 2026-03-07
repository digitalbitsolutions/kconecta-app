from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from urllib.parse import urlparse
from typing import Any

from ..constants import DEFAULT_WINDSURF_BASE_URL, EXTERNAL_MODEL_ROUTING


class WindsurfClient:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        api_key: str | None = None,
        default_model: str | None = None,
        api_style: str | None = None,
        timeout_seconds: int = 120,
    ) -> None:
        self.api_key = (api_key or os.environ.get("WINDSURF_API_KEY") or "").strip()
        self.api_style = (
            api_style
            or os.environ.get("WINDSURF_API_STYLE")
            or "auto"
        ).strip().lower()
        if self.api_style not in {"auto", "openai", "anthropic"}:
            self.api_style = "auto"
        raw_base_url = (
            base_url
            or os.environ.get("WINDSURF_BASE_URL")
            or DEFAULT_WINDSURF_BASE_URL
        ).rstrip("/")
        self.base_url = self._resolve_base_url(raw_base_url)
        self.default_model = (
            default_model
            or os.environ.get("WINDSURF_MODEL")
            or EXTERNAL_MODEL_ROUTING["windsurf"]
        ).strip()
        self.anthropic_model = (
            os.environ.get("WINDSURF_ANTHROPIC_MODEL")
            or "claude-sonnet-4-5-20250929"
        ).strip()
        self.anthropic_version = (
            os.environ.get("WINDSURF_ANTHROPIC_VERSION")
            or "2023-06-01"
        ).strip()
        self.timeout_seconds = timeout_seconds

    def is_configured(self) -> bool:
        return self.api_key != ""

    def configuration_status(self) -> dict[str, Any]:
        resolved_style = self._resolved_api_style()
        mapped_default = self._resolve_model_alias(self.default_model, style=resolved_style)
        return {
            "provider": "windsurf",
            "configured": self.is_configured(),
            "base_url": self.base_url,
            "api_style": resolved_style,
            "default_model": self.default_model,
            "effective_default_model": mapped_default,
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
            if self._resolved_api_style() == "anthropic":
                self._request_anthropic("GET", "/models")
            else:
                self._request_openai("GET", "/models")
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

        requested_model = (model or self.default_model).strip()
        style = self._resolved_api_style()
        model_name = self._resolve_model_alias(requested_model, style=style)
        if model_name == "":
            raise RuntimeError("Windsurf model is empty.")

        if style == "anthropic":
            body: dict[str, Any] = {
                "model": model_name,
                "temperature": 0,
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": prompt}],
            }
            if system:
                body["system"] = system
            response = self._request_anthropic("POST", "/messages", body)
            return self._extract_text_anthropic(response)

        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        body = {
            "model": model_name,
            "temperature": 0,
            "messages": messages,
        }
        response = self._request_openai("POST", "/chat/completions", body)
        return self._extract_text_openai(response)

    def _extract_text_openai(self, payload: dict[str, Any]) -> str:
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

    def _extract_text_anthropic(self, payload: dict[str, Any]) -> str:
        content = payload.get("content", [])
        if not isinstance(content, list):
            return ""

        chunks: list[str] = []
        for item in content:
            if not isinstance(item, dict):
                continue
            if str(item.get("type", "")).strip().lower() != "text":
                continue
            text = item.get("text", "")
            if isinstance(text, str) and text.strip():
                chunks.append(text.strip())
        return "\n".join(chunks).strip()

    def _request_openai(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        return self._request(method=method, path=path, headers=headers, payload=payload)

    def _request_anthropic(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": self.anthropic_version,
        }
        return self._request(method=method, path=path, headers=headers, payload=payload)

    def _request(
        self,
        *,
        method: str,
        path: str,
        headers: dict[str, str],
        payload: dict[str, Any] | None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        body = None
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

    def _resolved_api_style(self) -> str:
        if self.api_style in {"openai", "anthropic"}:
            return self.api_style
        if self.api_key.startswith("sk-ant-"):
            return "anthropic"
        hostname = urlparse(self.base_url).netloc.lower()
        if "anthropic.com" in hostname:
            return "anthropic"
        return "openai"

    def _resolve_base_url(self, base_url: str) -> str:
        candidate = base_url.strip().rstrip("/")
        if candidate == "":
            if self.api_style == "anthropic":
                return "https://api.anthropic.com/v1"
            if self.api_style == "auto" and self.api_key.startswith("sk-ant-"):
                return "https://api.anthropic.com/v1"
            return DEFAULT_WINDSURF_BASE_URL

        hostname = urlparse(candidate).netloc.lower()
        if self.api_style == "anthropic":
            if "anthropic.com" not in hostname:
                return "https://api.anthropic.com/v1"
            return candidate
        if self.api_style == "openai":
            return candidate

        if self.api_key.startswith("sk-ant-") and "windsurf.com" in hostname:
            return "https://api.anthropic.com/v1"
        return candidate

    def _resolve_model_alias(self, model_name: str, *, style: str) -> str:
        normalized = model_name.strip()
        if normalized == "":
            return ""
        if style != "anthropic":
            return normalized

        alias = normalized.lower().replace("_", "-")
        if alias in {"swe-1", "swe1", "windsurf-swe-1"}:
            return self.anthropic_model
        return normalized

    def _compact_error(self, error_text: str) -> str:
        normalized = " ".join(error_text.replace("\r", " ").replace("\n", " ").split())
        if len(normalized) > 260:
            return normalized[:260] + "..."
        return normalized
