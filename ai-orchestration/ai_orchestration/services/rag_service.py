from __future__ import annotations

import math
import re
from pathlib import Path
from typing import Any

from ..constants import DEFAULT_RAG_MAX_SNIPPET_CHARS, DEFAULT_RAG_TOP_K
from ..models import RagSnippet


class RagService:
    def __init__(self, repo_root: Path, config_file: Path) -> None:
        self.repo_root = repo_root
        self.config_file = config_file
        self.config = self._load_config()

    def search(
        self,
        query: str,
        *,
        top_k: int = DEFAULT_RAG_TOP_K,
        scope: list[str] | None = None,
    ) -> list[RagSnippet]:
        terms = self._tokenize(query)
        if not terms:
            return []

        candidates = list(self._iter_candidate_files(scope=scope))
        if not candidates:
            return []

        df: dict[str, int] = {term: 0 for term in terms}
        term_counts_by_file: dict[Path, dict[str, int]] = {}
        content_cache: dict[Path, str] = {}

        for file_path in candidates:
            text = self._safe_read(file_path)
            if not text:
                continue
            content_cache[file_path] = text
            lower = text.lower()
            counts: dict[str, int] = {}
            for term in terms:
                count = lower.count(term)
                if count > 0:
                    counts[term] = count
                    df[term] += 1
            if counts:
                term_counts_by_file[file_path] = counts

        if not term_counts_by_file:
            return []

        n_docs = len(term_counts_by_file)
        scored: list[tuple[float, Path]] = []

        for file_path, counts in term_counts_by_file.items():
            score = 0.0
            path_lower = str(file_path.relative_to(self.repo_root)).replace("\\", "/").lower()
            for term, tf in counts.items():
                idf = math.log((1 + n_docs) / (1 + df[term])) + 1
                score += tf * idf
                if term in path_lower:
                    score += 0.4
            scored.append((score, file_path))

        scored.sort(key=lambda item: item[0], reverse=True)
        snippets: list[RagSnippet] = []
        for score, file_path in scored[: max(1, top_k)]:
            text = content_cache[file_path]
            excerpt = self._excerpt(text, terms)
            snippets.append(
                RagSnippet(
                    path=str(file_path.relative_to(self.repo_root)).replace("\\", "/"),
                    score=round(score, 4),
                    excerpt=excerpt,
                )
            )
        return snippets

    def _load_config(self) -> dict[str, Any]:
        if not self.config_file.exists():
            return self._default_config()

        suffix = self.config_file.suffix.lower()
        if suffix not in {".yaml", ".yml", ".json"}:
            return self._default_config()

        text = self.config_file.read_text(encoding="utf-8")
        if suffix == ".json":
            import json

            data = json.loads(text)
        else:
            try:
                import yaml  # type: ignore
            except ModuleNotFoundError:
                return self._default_config()
            data = yaml.safe_load(text)  # type: ignore[attr-defined]

        if not isinstance(data, dict):
            return self._default_config()

        merged = self._default_config()
        for key in ("include_extensions", "exclude_dirs", "max_file_bytes", "max_snippet_chars"):
            if key in data:
                merged[key] = data[key]
        return merged

    def _default_config(self) -> dict[str, Any]:
        return {
            "include_extensions": [
                ".md",
                ".txt",
                ".json",
                ".yaml",
                ".yml",
                ".py",
                ".php",
                ".js",
                ".jsx",
                ".ts",
                ".tsx",
            ],
            "exclude_dirs": [
                ".git",
                "node_modules",
                "vendor",
                "public",
                "storage",
                ".ai-worktrees",
                "ai-orchestration/logs",
                "ai-orchestration/state",
            ],
            "max_file_bytes": 240000,
            "max_snippet_chars": DEFAULT_RAG_MAX_SNIPPET_CHARS,
        }

    def _iter_candidate_files(self, scope: list[str] | None) -> list[Path]:
        include_extensions = {
            str(ext).strip().lower()
            for ext in (self.config.get("include_extensions") or [])
            if str(ext).strip()
        }
        exclude_dirs = {
            str(item).replace("\\", "/").strip().lower()
            for item in (self.config.get("exclude_dirs") or [])
            if str(item).strip()
        }
        max_file_bytes = int(self.config.get("max_file_bytes", 240000))

        scope_filters = self._normalize_scope(scope or [])
        files: list[Path] = []
        for file_path in self.repo_root.rglob("*"):
            if not file_path.is_file():
                continue
            rel = str(file_path.relative_to(self.repo_root)).replace("\\", "/")
            rel_lower = rel.lower()
            if any(rel_lower.startswith(prefix) for prefix in exclude_dirs):
                continue
            if include_extensions and file_path.suffix.lower() not in include_extensions:
                continue
            if file_path.stat().st_size > max_file_bytes:
                continue
            if scope_filters and not any(rel_lower.startswith(prefix) for prefix in scope_filters):
                continue
            files.append(file_path)
        return files

    def _normalize_scope(self, raw_scope: list[str]) -> set[str]:
        normalized: set[str] = set()
        for raw in raw_scope:
            value = str(raw).replace("\\", "/").strip().lower()
            if not value:
                continue
            if value.startswith("./"):
                value = value[2:]
            if value.endswith("/"):
                normalized.add(value)
                continue
            if "." in Path(value).name:
                parent = str(Path(value).parent).replace("\\", "/").strip().lower()
                if parent and parent != ".":
                    normalized.add(parent + "/")
                else:
                    normalized.add(value)
            else:
                normalized.add(value + "/")
        return normalized

    def _safe_read(self, file_path: Path) -> str:
        try:
            return file_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return ""

    def _tokenize(self, text: str) -> list[str]:
        tokens = re.findall(r"[a-zA-Z0-9_]{3,}", text.lower())
        unique: list[str] = []
        seen: set[str] = set()
        for token in tokens:
            if token not in seen:
                seen.add(token)
                unique.append(token)
        return unique

    def _excerpt(self, text: str, terms: list[str]) -> str:
        max_chars = int(self.config.get("max_snippet_chars", DEFAULT_RAG_MAX_SNIPPET_CHARS))
        lowered = text.lower()
        index = -1
        for term in terms:
            pos = lowered.find(term)
            if pos >= 0:
                index = pos
                break
        if index < 0:
            compact = " ".join(text.split())
            return compact[:max_chars]

        start = max(0, index - max_chars // 3)
        end = min(len(text), start + max_chars)
        snippet = text[start:end]
        return " ".join(snippet.split())
