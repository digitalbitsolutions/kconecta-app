from __future__ import annotations

from pathlib import Path

from ..constants import AGENT_BRANCHES, SEMANTIC_COMMIT_PREFIXES
from .command_runner import CommandError, CommandResult, CommandRunner


class GitService:
    def __init__(self, repo_root: Path, runner: CommandRunner | None = None) -> None:
        self.repo_root = repo_root
        self.runner = runner or CommandRunner()

    def run(
        self,
        args: list[str],
        *,
        cwd: Path | None = None,
        check: bool = True,
    ) -> CommandResult:
        return self.runner.run(
            ["git", *args],
            cwd=cwd or self.repo_root,
            check=check,
        )

    def is_repo(self) -> bool:
        try:
            result = self.run(["rev-parse", "--is-inside-work-tree"])
            return result.stdout.strip().lower() == "true"
        except CommandError:
            return False

    def has_commits(self) -> bool:
        result = self.run(["rev-parse", "--verify", "HEAD"], check=False)
        return result.returncode == 0

    def current_branch(self, cwd: Path | None = None) -> str:
        symbolic = self.run(["symbolic-ref", "--short", "HEAD"], cwd=cwd, check=False)
        if symbolic.returncode == 0 and symbolic.stdout.strip():
            return symbolic.stdout.strip()

        result = self.run(["rev-parse", "--abbrev-ref", "HEAD"], cwd=cwd, check=False)
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()

        return "(unknown)"

    def status_porcelain(self, cwd: Path | None = None) -> list[str]:
        result = self.run(["status", "--porcelain"], cwd=cwd)
        output = result.stdout.strip()
        return output.splitlines() if output else []

    def remote_url(self, name: str = "origin") -> str | None:
        result = self.run(["remote", "get-url", name], check=False)
        return result.stdout.strip() if result.returncode == 0 and result.stdout.strip() else None

    def branch_exists(self, branch: str) -> bool:
        result = self.run(
            ["show-ref", "--verify", "--quiet", f"refs/heads/{branch}"],
            check=False,
        )
        return result.returncode == 0

    def ensure_base_branch(self, base_branch: str) -> str:
        if self.branch_exists(base_branch):
            return base_branch

        if not self.has_commits():
            raise RuntimeError(
                "Repository has no commits. Create an initial commit before bootstrapping branches."
            )

        fallback = "master"
        if self.branch_exists(fallback):
            self.run(["branch", base_branch, fallback], check=True)
            return base_branch

        current = self.current_branch()
        self.run(["branch", base_branch, current], check=True)
        return base_branch

    def ensure_agent_branches(self, base_branch: str) -> list[str]:
        resolved_base = self.ensure_base_branch(base_branch)
        created: list[str] = []
        for branch in AGENT_BRANCHES.values():
            if self.branch_exists(branch):
                continue
            self.run(["branch", branch, resolved_base], check=True)
            created.append(branch)
        return created

    def ensure_worktree(
        self,
        agent_name: str,
        branch: str,
        worktree_root: Path,
        base_branch: str,
    ) -> Path:
        self.ensure_agent_branches(base_branch)
        worktree_root.mkdir(parents=True, exist_ok=True)
        worktree_path = worktree_root / agent_name

        if worktree_path.exists():
            existing_branch = self.current_branch(cwd=worktree_path)
            if existing_branch != branch:
                raise RuntimeError(
                    f"Existing worktree {worktree_path} is on branch {existing_branch}, expected {branch}."
                )
            return worktree_path

        self.run(["worktree", "add", str(worktree_path), branch], check=True)
        return worktree_path

    def changed_files(self, cwd: Path | None = None) -> list[str]:
        lines = self.status_porcelain(cwd=cwd)
        files: list[str] = []
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            parts = stripped.split(maxsplit=1)
            if len(parts) < 2:
                continue
            path = parts[1].strip()
            if " -> " in path:
                path = path.split(" -> ", maxsplit=1)[1].strip()
            if path:
                files.append(path)
        return files

    def validate_semantic_commit(self, message: str) -> None:
        normalized = message.strip()
        if not normalized:
            raise ValueError("Commit message cannot be empty.")

        if ":" not in normalized:
            raise ValueError("Commit message must include a semantic prefix (e.g. feat: ...).")

        prefix = normalized.split(":", maxsplit=1)[0].strip().lower()
        if prefix not in SEMANTIC_COMMIT_PREFIXES:
            raise ValueError(
                f"Invalid semantic prefix '{prefix}'. Expected one of: "
                + ", ".join(SEMANTIC_COMMIT_PREFIXES)
            )

    def commit(self, cwd: Path, message: str, agent_name: str) -> list[str]:
        self.validate_semantic_commit(message)

        expected_branch = AGENT_BRANCHES[agent_name]
        actual_branch = self.current_branch(cwd=cwd)
        if actual_branch != expected_branch:
            raise RuntimeError(
                f"Branch policy violation: {agent_name} can only commit to {expected_branch}, "
                f"but worktree is on {actual_branch}."
            )

        changed = self.changed_files(cwd=cwd)
        if not changed:
            return []

        self.run(["add", "-A"], cwd=cwd, check=True)
        self.run(["commit", "-m", message], cwd=cwd, check=True)
        return changed

    def latest_commit_subject(self, branch: str) -> str:
        result = self.run(
            ["log", branch, "-1", "--pretty=%s"],
            check=False,
        )
        return result.stdout.strip() if result.returncode == 0 else ""

    def push_branch(self, branch: str) -> None:
        self.run(["push", "-u", "origin", branch], check=True)
