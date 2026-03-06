from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

from ..constants import DEFAULT_OLLAMA_BASE_URL
from .command_runner import CommandRunner


class OllamaClient:
    def __init__(
        self,
        base_url: str = DEFAULT_OLLAMA_BASE_URL,
        timeout_seconds: int = 180,
        runner: CommandRunner | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.runner = runner or CommandRunner()

    def health_check(self) -> bool:
        try:
            self._request("GET", "/api/tags")
            return True
        except Exception:
            return False

    def list_models(self) -> set[str]:
        payload = self._request("GET", "/api/tags")
        models = payload.get("models", [])
        return {str(item.get("name", "")).strip() for item in models if item.get("name")}

    def pull_model(self, model: str) -> None:
        self.runner.run(["ollama", "pull", model], check=True, timeout=3600)

    def generate(
        self,
        model: str,
        prompt: str,
        *,
        system: str | None = None,
        options: dict[str, Any] | None = None,
    ) -> str:
        payload: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": options or {"temperature": 0},
        }
        if system:
            payload["system"] = system

        response = self._request("POST", "/api/generate", payload)
        return str(response.get("response", "")).strip()

    def _request(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        body = None
        headers = {"Content-Type": "application/json"}
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")

        request = urllib.request.Request(
            f"{self.base_url}{path}",
            method=method,
            data=body,
            headers=headers,
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            details = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Ollama HTTP error {exc.code}: {details}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Cannot reach Ollama at {self.base_url}: {exc}") from exc
