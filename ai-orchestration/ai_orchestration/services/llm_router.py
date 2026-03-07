from __future__ import annotations

from typing import Any

from ..constants import SUPPORTED_LLM_PROVIDERS
from ..models import TaskSpec
from .google_ag_client import GoogleAgClient
from .ollama_client import OllamaClient
from .windsurf_client import WindsurfClient


class LlmRouter:
    def __init__(
        self,
        *,
        ollama: OllamaClient,
        google_ag: GoogleAgClient,
        windsurf: WindsurfClient,
    ) -> None:
        self.ollama = ollama
        self.google_ag = google_ag
        self.windsurf = windsurf

    def generate(
        self,
        *,
        task: TaskSpec,
        phase: str,
        default_model: str,
        prompt: str,
        system: str | None = None,
    ) -> tuple[str, dict[str, str]]:
        provider, model = self._select_provider_and_model(
            task=task,
            phase=phase,
            default_model=default_model,
        )
        attempts = self._build_attempt_plan(
            primary_provider=provider,
            primary_model=model,
            default_model=default_model,
        )

        errors: list[str] = []
        for candidate_provider, candidate_model in attempts:
            try:
                text = self._generate_with_provider(
                    provider=candidate_provider,
                    model=candidate_model,
                    prompt=prompt,
                    system=system,
                )
                route: dict[str, str] = {
                    "phase": phase,
                    "provider": candidate_provider,
                    "model": candidate_model,
                }
                if candidate_provider != provider:
                    route["fallback_from"] = provider
                if errors:
                    route["fallback_errors"] = " | ".join(errors)
                return text, route
            except Exception as exc:
                errors.append(
                    f"{candidate_provider}: {self._compact_error(str(exc))}"
                )
                continue

        raise RuntimeError("All LLM providers failed. " + " | ".join(errors))

    def preflight_status(self) -> dict[str, Any]:
        google = self.google_ag.diagnose()
        windsurf = self.windsurf.diagnose()
        return {
            "default_policy": self._policy_text(),
            "providers": {
                "ollama": {
                    "configured": True,
                    "healthy": self.ollama.health_check(),
                },
                "google_ag": google,
                "windsurf": windsurf,
            },
        }

    def _policy_text(self) -> str:
        return (
            "planning -> Google AG; proposal/codegen -> Ollama DeepSeek; "
            "review -> Ollama lightweight (Windsurf deprecated); "
            "fallback to Ollama."
        )

    def _select_provider_and_model(
        self,
        *,
        task: TaskSpec,
        phase: str,
        default_model: str,
    ) -> tuple[str, str]:
        metadata = task.metadata or {}
        explicit_provider = str(metadata.get("llm_provider", "auto")).strip().lower() or "auto"
        global_model = str(metadata.get("llm_model", "")).strip()
        phase_model = str(metadata.get(f"{phase}_model", "")).strip()
        chosen_model = phase_model or global_model

        if explicit_provider != "auto":
            provider = self._normalize_provider(explicit_provider)
            if provider == "windsurf":
                # Backward compatibility: map deprecated windsurf provider to local review.
                return "ollama", default_model
            if provider == "google_ag":
                if self.google_ag.is_configured():
                    return provider, chosen_model or self.google_ag.default_model
                return "ollama", default_model
            if provider == "ollama":
                return provider, chosen_model or default_model

        normalized_phase = phase.strip().lower()
        if normalized_phase == "planning":
            if self.google_ag.is_configured():
                return "google_ag", chosen_model or self.google_ag.default_model
            return "ollama", default_model

        if normalized_phase == "review":
            return "ollama", default_model

        # Default implementation/code generation phase: keep local-first.
        return "ollama", phase_model or default_model

    def _build_attempt_plan(
        self,
        *,
        primary_provider: str,
        primary_model: str,
        default_model: str,
    ) -> list[tuple[str, str]]:
        attempts: list[tuple[str, str]] = [(primary_provider, primary_model)]

        if primary_provider == "windsurf":
            attempts.append(("ollama", default_model))
            return self._dedupe_attempts(attempts)

        if primary_provider == "google_ag":
            attempts.append(("ollama", default_model))
            return self._dedupe_attempts(attempts)

        return self._dedupe_attempts(attempts)

    def _dedupe_attempts(self, attempts: list[tuple[str, str]]) -> list[tuple[str, str]]:
        seen: set[tuple[str, str]] = set()
        unique: list[tuple[str, str]] = []
        for item in attempts:
            if item in seen:
                continue
            seen.add(item)
            unique.append(item)
        return unique

    def _generate_with_provider(
        self,
        *,
        provider: str,
        model: str,
        prompt: str,
        system: str | None,
    ) -> str:
        if provider == "windsurf":
            return self.windsurf.generate(prompt=prompt, model=model, system=system)
        if provider == "google_ag":
            return self.google_ag.generate(prompt=prompt, model=model, system=system)
        return self.ollama.generate(model, prompt, system=system)

    def _compact_error(self, error_text: str) -> str:
        normalized = " ".join(error_text.replace("\r", " ").replace("\n", " ").split())
        if len(normalized) > 320:
            return normalized[:320] + "..."
        return normalized

    def _normalize_provider(self, provider: str) -> str:
        normalized = provider.strip().lower()
        if normalized in SUPPORTED_LLM_PROVIDERS:
            return normalized
        return "auto"
