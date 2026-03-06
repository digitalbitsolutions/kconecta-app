from __future__ import annotations

import base64
import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from ..models import TaskSpec


class JiraService:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        user_email: str | None = None,
        api_token: str | None = None,
        project_key: str | None = None,
        env_file: Path | None = None,
        timeout_seconds: int = 30,
    ) -> None:
        env_values = self._load_env_file(env_file or Path("ai-orchestration/.env.jira"))

        self.base_url = (
            base_url
            or os.environ.get("JIRA_BASE_URL")
            or env_values.get("JIRA_BASE_URL", "")
        ).rstrip("/")
        self.user_email = (
            user_email
            or os.environ.get("JIRA_USER_EMAIL")
            or env_values.get("JIRA_USER_EMAIL", "")
        )
        self.api_token = (
            api_token
            or os.environ.get("JIRA_API_TOKEN")
            or env_values.get("JIRA_API_TOKEN", "")
        )
        self.project_key = (
            project_key
            or os.environ.get("JIRA_PROJECT_KEY")
            or env_values.get("JIRA_PROJECT_KEY", "")
        ).strip().upper()
        self.timeout_seconds = timeout_seconds

    def configuration_status(self) -> dict[str, Any]:
        values = {
            "JIRA_BASE_URL": self.base_url,
            "JIRA_USER_EMAIL": self.user_email,
            "JIRA_API_TOKEN": self.api_token,
            "JIRA_PROJECT_KEY": self.project_key,
        }
        missing = [
            name
            for name, value in values.items()
            if not value or self._is_placeholder_value(name, value)
        ]
        return {
            "configured": not missing,
            "missing_env": missing,
            "base_url": self.base_url,
            "project_key": self.project_key,
        }

    def preflight(self) -> dict[str, Any]:
        status = self.configuration_status()
        if not status["configured"]:
            return {
                **status,
                "reachable": False,
                "account": None,
                "project": None,
            }

        account = self._request("GET", "/rest/api/3/myself")
        project = self._request("GET", f"/rest/api/3/project/{self.project_key}")
        account_name = str(account.get("displayName", "")).strip()
        project_name = str(project.get("name", "")).strip()
        return {
            **status,
            "reachable": True,
            "account": {
                "display_name": account_name,
                "account_id": account.get("accountId"),
            },
            "project": {
                "key": self.project_key,
                "name": project_name,
            },
        }

    def create_issue_from_task(
        self,
        task: TaskSpec,
        *,
        issue_type: str = "Task",
        labels: list[str] | None = None,
    ) -> dict[str, Any]:
        self._assert_configured()
        summary = f"[{task.agent}] {task.id} - {task.title}"
        merged_labels = {
            "ai-orchestration",
            f"agent-{task.agent}",
            f"priority-{task.priority}",
        }
        merged_labels.update((labels or []))
        merged_labels.update(self._labels_from_metadata(task.metadata))
        body = self._task_description(task)
        payload = {
            "fields": {
                "project": {"key": self.project_key},
                "issuetype": {"name": issue_type},
                "summary": summary,
                "description": self._to_adf(body),
                "labels": sorted(item for item in merged_labels if item),
            }
        }
        created = self._request("POST", "/rest/api/3/issue", payload)
        issue_key = str(created.get("key", "")).strip()
        if not issue_key:
            raise RuntimeError("Jira issue creation returned no issue key.")
        return {
            "key": issue_key,
            "id": created.get("id"),
            "url": f"{self.base_url}/browse/{issue_key}",
        }

    def add_comment(self, issue_key: str, text: str) -> dict[str, Any]:
        self._assert_configured()
        payload = {"body": self._to_adf(text)}
        comment = self._request(
            "POST",
            f"/rest/api/3/issue/{issue_key}/comment",
            payload,
        )
        return {
            "issue": issue_key,
            "comment_id": comment.get("id"),
        }

    def transition_issue(self, issue_key: str, to_status: str) -> dict[str, Any]:
        self._assert_configured()
        transitions = self._request("GET", f"/rest/api/3/issue/{issue_key}/transitions")
        items = transitions.get("transitions", [])
        if not isinstance(items, list):
            items = []

        transition_id = None
        candidate = to_status.strip().lower()
        for item in items:
            if not isinstance(item, dict):
                continue
            item_id = str(item.get("id", "")).strip()
            item_name = str(item.get("name", "")).strip().lower()
            if candidate in {item_id.lower(), item_name}:
                transition_id = item_id
                break

        if not transition_id:
            available = [str(item.get("name", "")).strip() for item in items if isinstance(item, dict)]
            raise RuntimeError(
                f"Transition '{to_status}' not found for issue {issue_key}. "
                f"Available: {', '.join(item for item in available if item)}"
            )

        self._request(
            "POST",
            f"/rest/api/3/issue/{issue_key}/transitions",
            {"transition": {"id": transition_id}},
        )
        return {
            "issue": issue_key,
            "transition_id": transition_id,
            "to": to_status,
        }

    def list_issues(
        self,
        *,
        agent: str | None = None,
        status: str = "open",
        max_results: int = 20,
    ) -> dict[str, Any]:
        self._assert_configured()
        jql_parts = [f"project = {self.project_key}"]
        if agent:
            jql_parts.append(f'labels = "agent-{agent}"')

        normalized_status = status.strip().lower()
        if normalized_status == "open":
            jql_parts.append("statusCategory != Done")
        elif normalized_status == "done":
            jql_parts.append("statusCategory = Done")
        elif normalized_status != "all":
            raise ValueError("status must be one of: open, done, all")

        jql = " AND ".join(jql_parts) + " ORDER BY created DESC"
        payload = {
            "jql": jql,
            "maxResults": max(1, min(max_results, 100)),
            "fields": ["summary", "status", "labels"],
        }
        result = self._request("POST", "/rest/api/3/search", payload)
        issues = result.get("issues", [])
        if not isinstance(issues, list):
            issues = []
        entries = []
        for issue in issues:
            if not isinstance(issue, dict):
                continue
            key = str(issue.get("key", "")).strip()
            fields = issue.get("fields", {}) if isinstance(issue.get("fields"), dict) else {}
            status_obj = fields.get("status", {}) if isinstance(fields.get("status"), dict) else {}
            entries.append(
                {
                    "key": key,
                    "summary": fields.get("summary"),
                    "status": status_obj.get("name"),
                    "labels": fields.get("labels", []),
                    "url": f"{self.base_url}/browse/{key}" if key else None,
                }
            )

        return {
            "jql": jql,
            "total": result.get("total", len(entries)),
            "issues": entries,
        }

    def _assert_configured(self) -> None:
        status = self.configuration_status()
        if not status["configured"]:
            missing = ", ".join(status["missing_env"])
            raise RuntimeError(f"Jira is not configured. Missing env vars: {missing}")

    def _request(
        self,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        body = None
        headers = self._headers()
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
            raise RuntimeError(f"Jira HTTP error {exc.code}: {details}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Cannot reach Jira at {self.base_url}: {exc}") from exc

    def _headers(self) -> dict[str, str]:
        token = base64.b64encode(f"{self.user_email}:{self.api_token}".encode("utf-8")).decode(
            "ascii"
        )
        return {
            "Authorization": f"Basic {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def _labels_from_metadata(self, metadata: dict[str, Any]) -> set[str]:
        labels: set[str] = set()
        for key in ("owner", "domain", "suite", "platform", "stack"):
            value = metadata.get(key)
            if value:
                labels.add(f"{key}-{self._sanitize_label(str(value))}")
        return labels

    def _task_description(self, task: TaskSpec) -> str:
        scope = "\n".join(f"- {path}" for path in task.files_scope) or "- (not provided)"
        acceptance = (
            "\n".join(f"- {item}" for item in task.acceptance_criteria) or "- (not provided)"
        )
        return (
            f"Task ID: {task.id}\n"
            f"Agent: {task.agent}\n"
            f"Priority: {task.priority}\n"
            f"Commit Type: {task.commit_type}\n\n"
            f"Description:\n{task.description}\n\n"
            f"File Scope:\n{scope}\n\n"
            f"Acceptance Criteria:\n{acceptance}\n"
        )

    def _to_adf(self, text: str) -> dict[str, Any]:
        lines = [line.rstrip() for line in text.replace("\r\n", "\n").split("\n")]
        content = []
        for line in lines:
            if not line:
                content.append({"type": "paragraph", "content": []})
                continue
            content.append(
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": line}],
                }
            )
        return {"type": "doc", "version": 1, "content": content}

    def _sanitize_label(self, value: str) -> str:
        chars = []
        for ch in value.lower():
            if ch.isalnum() or ch in {"-", "_"}:
                chars.append(ch)
            elif ch in {" ", ".", "/"}:
                chars.append("-")
        normalized = "".join(chars).strip("-")
        return normalized[:255] if normalized else "n-a"

    def _is_placeholder_value(self, key: str, value: str) -> bool:
        candidate = value.strip().lower()
        placeholders = {
            "JIRA_BASE_URL": {
                "https://your-domain.atlassian.net",
                "your-domain",
            },
            "JIRA_USER_EMAIL": {
                "you@example.com",
            },
            "JIRA_API_TOKEN": {
                "your_jira_api_token",
            },
        }
        if key in placeholders and candidate in placeholders[key]:
            return True
        return "your_" in candidate or "example.com" in candidate

    def _load_env_file(self, env_file: Path) -> dict[str, str]:
        try:
            if not env_file.exists():
                return {}
            values: dict[str, str] = {}
            for raw_line in env_file.read_text(encoding="utf-8").splitlines():
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", maxsplit=1)
                values[key.strip()] = value.strip().strip("\"'").strip()
            return values
        except OSError:
            return {}
