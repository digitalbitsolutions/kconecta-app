from __future__ import annotations

import json
import re

from ..constants import AGENT_BRANCHES
from .command_runner import CommandRunner
from .git_service import GitService


class PullRequestService:
    ISSUE_KEY_PATTERN = re.compile(r"^[A-Z][A-Z0-9]+-\d+$")

    def __init__(self, git_service: GitService, runner: CommandRunner | None = None) -> None:
        self.git = git_service
        self.runner = runner or CommandRunner()

    def check_gh_available(self) -> bool:
        result = self.runner.run(["gh", "--version"], check=False)
        return result.returncode == 0

    def create_draft_pr(
        self,
        agent: str,
        base_branch: str,
        *,
        issue_key: str | None = None,
    ) -> str:
        remote = self.git.remote_url("origin")
        if not remote:
            raise RuntimeError(
                "Remote 'origin' is not configured. Add your GitHub remote before creating PRs."
            )
        normalized_issue = self._normalize_issue_key(issue_key)

        branch = AGENT_BRANCHES[agent]
        self.git.push_branch(branch)

        latest_subject = self.git.latest_commit_subject(branch) or "AI update"
        title = f"[AI/{agent}] {latest_subject}"
        if normalized_issue:
            title = f"{normalized_issue} {title}"
        body = (
            "## AI Orchestration Change\n"
            f"- Agent: `{agent}`\n"
            f"- Branch: `{branch}`\n"
            f"- Base: `{base_branch}`\n"
            f"- Jira issue: `{normalized_issue or '(not set)'}`\n"
            "- Generated with local Ollama + Aider.\n\n"
            "## Review Checklist\n"
            "- [ ] Scope is correct\n"
            "- [ ] Tests/checks passed\n"
            "- [ ] Ready for manual merge approval\n"
        )

        result = self.runner.run(
            [
                "gh",
                "pr",
                "create",
                "--draft",
                "--base",
                base_branch,
                "--head",
                branch,
                "--title",
                title,
                "--body",
                body,
            ],
            cwd=self.git.repo_root,
            check=True,
        )
        return result.stdout.strip()

    def _normalize_issue_key(self, issue_key: str | None) -> str | None:
        if not issue_key:
            return None
        normalized = issue_key.strip().upper()
        if not normalized:
            return None
        if not self.ISSUE_KEY_PATTERN.match(normalized):
            raise ValueError(
                "Invalid Jira issue key format. Expected pattern like DEV-72."
            )
        return normalized

    def view(self, pr_id: str) -> dict[str, str | bool]:
        result = self.runner.run(
            [
                "gh",
                "pr",
                "view",
                str(pr_id),
                "--json",
                "number,state,isDraft,baseRefName,headRefName,mergeable,url,title",
            ],
            cwd=self.git.repo_root,
            check=True,
        )
        payload = json.loads(result.stdout)
        if not isinstance(payload, dict):
            raise RuntimeError("Unexpected response from gh pr view.")
        return payload

    def run_checks(self, pr_id: str) -> bool:
        result = self.runner.run(
            ["gh", "pr", "checks", str(pr_id)],
            cwd=self.git.repo_root,
            check=False,
        )
        return result.returncode == 0

    def merge(self, pr_id: str) -> str:
        result = self.runner.run(
            ["gh", "pr", "merge", str(pr_id), "--merge"],
            cwd=self.git.repo_root,
            check=True,
        )
        return result.stdout.strip()
