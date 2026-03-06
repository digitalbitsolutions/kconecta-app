from __future__ import annotations

import argparse
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .agents.factory import create_agent
from .constants import (
    AGENT_BRANCHES,
    APPROVAL_STORE_FILE,
    DEFAULT_BASE_BRANCH,
    DEFAULT_WORKTREE_DIRNAME,
    LOG_FILE,
    REQUIRED_OLLAMA_MODELS,
)
from .models import TaskSpec
from .services.aider_service import AiderService
from .services.approval_store import ApprovalStore
from .services.audit_logger import AuditLogger
from .services.command_runner import CommandRunner
from .services.git_service import GitService
from .services.ollama_client import OllamaClient
from .services.pr_service import PullRequestService
from .services.task_service import TaskService


class Orchestrator:
    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root
        self.worktree_root = self.repo_root / DEFAULT_WORKTREE_DIRNAME
        self.runner = CommandRunner()
        self.git = GitService(self.repo_root, runner=self.runner)
        self.ollama = OllamaClient(runner=self.runner)
        self.task_service = TaskService()
        self.audit = AuditLogger(self.repo_root / LOG_FILE)
        self.approval_store = ApprovalStore(self.repo_root / APPROVAL_STORE_FILE)
        self.aider = AiderService(runner=self.runner)
        self.pr_service = PullRequestService(self.git, runner=self.runner)

    def preflight(self, fix_models: bool = False) -> dict[str, Any]:
        report: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "repo_root": str(self.repo_root),
            "checks": {},
        }

        report["checks"]["git_repo"] = self.git.is_repo()
        report["checks"]["has_commits"] = self.git.has_commits()
        report["checks"]["current_branch"] = (
            self.git.current_branch() if report["checks"]["git_repo"] else "(not-a-repo)"
        )
        report["checks"]["origin_remote"] = self.git.remote_url("origin")
        report["checks"]["dirty_files"] = self.git.changed_files()

        report["checks"]["ollama_health"] = self.ollama.health_check()
        installed_models = self.ollama.list_models() if report["checks"]["ollama_health"] else set()
        report["checks"]["installed_models"] = sorted(installed_models)
        missing_models = sorted(
            model
            for model in REQUIRED_OLLAMA_MODELS
            if not self._model_is_available(model, installed_models)
        )
        report["checks"]["missing_models"] = missing_models

        report["checks"]["aider_command"] = self._resolve_aider_command()
        report["checks"]["gh_available"] = self.pr_service.check_gh_available()
        report["checks"]["python_launcher"] = self.runner.run(
            ["py", "--version"], check=False
        ).stdout

        if fix_models and missing_models:
            pulled: list[str] = []
            for model in missing_models:
                self.ollama.pull_model(model)
                pulled.append(model)
            refreshed = self.ollama.list_models()
            report["checks"]["installed_models_after_fix"] = sorted(refreshed)
            report["checks"]["pulled_models"] = pulled
            report["checks"]["missing_models_after_fix"] = sorted(
                model
                for model in REQUIRED_OLLAMA_MODELS
                if not self._model_is_available(model, refreshed)
            )

        self.audit.log("preflight", report)
        return report

    def bootstrap_branches(self, base_branch: str = DEFAULT_BASE_BRANCH) -> dict[str, Any]:
        base = self.git.ensure_base_branch(base_branch)
        created = self.git.ensure_agent_branches(base)

        worktrees: dict[str, str] = {}
        for agent_name, branch in AGENT_BRANCHES.items():
            worktree = self.git.ensure_worktree(
                agent_name=agent_name,
                branch=branch,
                worktree_root=self.worktree_root,
                base_branch=base,
            )
            worktrees[agent_name] = str(worktree)

        payload = {
            "base_branch": base,
            "created_branches": created,
            "worktrees": worktrees,
        }
        self.audit.log("bootstrap_branches", payload)
        return payload

    def run_task(self, agent_name: str, task_file: Path, dry_run: bool = False) -> dict[str, Any]:
        normalized_agent = agent_name.strip().lower()
        if normalized_agent not in AGENT_BRANCHES:
            raise ValueError(
                f"Unknown agent '{agent_name}'. Expected: {', '.join(sorted(AGENT_BRANCHES.keys()))}"
            )

        task = self.task_service.load(task_file)
        self._validate_task_agent(task, normalized_agent)

        base = self.git.ensure_base_branch(DEFAULT_BASE_BRANCH)
        branch = AGENT_BRANCHES[normalized_agent]
        worktree = self.git.ensure_worktree(
            agent_name=normalized_agent,
            branch=branch,
            worktree_root=self.worktree_root,
            base_branch=base,
        )

        agent = create_agent(normalized_agent, self.ollama)
        output = agent.execute(task)

        if dry_run:
            payload = {
                "mode": "dry-run",
                "agent": normalized_agent,
                "task": task.to_dict(),
                "agent_output": output.to_dict(),
                "worktree": str(worktree),
                "branch": branch,
            }
            self.audit.log("run_task_dry_run", payload)
            return payload

        file_scope = output.target_files or task.files_scope
        if not file_scope:
            raise RuntimeError(
                "Task has no file scope. For non dry-run execution provide files_scope in task file."
            )

        prompt = self._build_aider_prompt(task, output)
        aider_result = self.aider.apply_patch(
            worktree=worktree,
            prompt=prompt,
            files=file_scope,
            model="deepseek-coder:6.7b",
        )
        changed_files = self.git.changed_files(cwd=worktree)
        commit_message = output.commit_message or f"{task.commit_type}: {task.title}"
        committed_files = self.git.commit(
            cwd=worktree,
            message=commit_message,
            agent_name=normalized_agent,
        )

        transcript_file = self._save_transcript(
            task_id=task.id,
            agent_name=normalized_agent,
            transcript=aider_result.stdout + ("\n" + aider_result.stderr if aider_result.stderr else ""),
        )

        payload = {
            "mode": "apply",
            "agent": normalized_agent,
            "task_id": task.id,
            "branch": branch,
            "worktree": str(worktree),
            "changed_files": changed_files,
            "committed_files": committed_files,
            "commit_message": commit_message,
            "aider_command": aider_result.command,
            "aider_transcript_file": str(transcript_file),
        }
        self.audit.log("run_task_apply", payload)
        return payload

    def create_pr(self, agent_name: str, base_branch: str = DEFAULT_BASE_BRANCH) -> dict[str, Any]:
        normalized_agent = agent_name.strip().lower()
        if normalized_agent not in AGENT_BRANCHES:
            raise ValueError(
                f"Unknown agent '{agent_name}'. Expected: {', '.join(sorted(AGENT_BRANCHES.keys()))}"
            )

        url = self.pr_service.create_draft_pr(normalized_agent, base_branch=base_branch)
        payload = {
            "agent": normalized_agent,
            "branch": AGENT_BRANCHES[normalized_agent],
            "base": base_branch,
            "pr_url": url,
        }
        self.audit.log("create_pr", payload)
        return payload

    def approve_merge(self, pr_id: str) -> dict[str, Any]:
        actor = (
            os.environ.get("GIT_AUTHOR_NAME")
            or os.environ.get("USERNAME")
            or os.environ.get("USER")
            or "unknown"
        )
        record = self.approval_store.approve(pr_id, actor=actor)
        payload = {"pr_id": str(pr_id), "approval": record}
        self.audit.log("approve_merge", payload)
        return payload

    def merge_pr(self, pr_id: str, skip_checks: bool = False) -> dict[str, Any]:
        if not self.approval_store.is_approved(pr_id):
            raise RuntimeError(
                f"PR {pr_id} is not approved. Run approve-merge before merge-pr."
            )

        pr_data = self.pr_service.view(pr_id)
        self._validate_pr_for_merge(pr_id, pr_data, skip_checks=skip_checks)
        merge_output = self.pr_service.merge(pr_id)

        payload = {
            "pr_id": str(pr_id),
            "pr": pr_data,
            "merge_output": merge_output,
            "skip_checks": skip_checks,
        }
        self.audit.log("merge_pr", payload)
        return payload

    def _validate_task_agent(self, task: TaskSpec, agent_name: str) -> None:
        if task.agent != agent_name:
            raise ValueError(
                f"Task agent mismatch. Task expects '{task.agent}', command received '{agent_name}'."
            )

    def _build_aider_prompt(self, task: TaskSpec, output: Any) -> str:
        validation_text = "\n".join(f"- {step}" for step in output.validation_steps) or "- none"
        file_scope_text = "\n".join(f"- {path}" for path in (output.target_files or task.files_scope))
        return (
            f"Implement task '{task.id}: {task.title}'.\n"
            f"Description:\n{task.description}\n\n"
            f"Plan summary:\n{output.plan_summary}\n\n"
            f"Required changes:\n{output.proposed_changes}\n\n"
            f"Allowed file scope:\n{file_scope_text}\n\n"
            f"Validation steps:\n{validation_text}\n"
            "Preserve existing behavior outside scope."
        )

    def _save_transcript(self, task_id: str, agent_name: str, transcript: str) -> Path:
        transcript_dir = self.repo_root / "ai-orchestration" / "logs" / "transcripts"
        transcript_dir.mkdir(parents=True, exist_ok=True)
        safe_task = "".join(ch for ch in task_id if ch.isalnum() or ch in {"-", "_"})
        file_path = transcript_dir / f"{safe_task}_{agent_name}.log"
        file_path.write_text(transcript.strip() + "\n", encoding="utf-8")
        return file_path

    def _resolve_aider_command(self) -> str:
        try:
            command = self.aider.resolve_command()
            return " ".join(command)
        except Exception as exc:
            return f"(not available) {exc}"

    def _model_is_available(self, required_model: str, installed_models: set[str]) -> bool:
        if required_model in installed_models:
            return True
        return any(model.startswith(required_model + ":") for model in installed_models)

    def _validate_pr_for_merge(
        self,
        pr_id: str,
        pr_data: dict[str, Any],
        *,
        skip_checks: bool,
    ) -> None:
        state = str(pr_data.get("state", "")).upper()
        is_draft = bool(pr_data.get("isDraft", True))
        base_ref = str(pr_data.get("baseRefName", ""))
        mergeable = str(pr_data.get("mergeable", "")).upper()

        if state != "OPEN":
            raise RuntimeError(f"PR {pr_id} is not open (state={state}).")
        if is_draft:
            raise RuntimeError(f"PR {pr_id} is still draft. Mark ready before merging.")
        if base_ref != DEFAULT_BASE_BRANCH:
            raise RuntimeError(
                f"PR {pr_id} base branch is '{base_ref}', expected '{DEFAULT_BASE_BRANCH}'."
            )
        if mergeable == "CONFLICTING":
            raise RuntimeError(f"PR {pr_id} has conflicts and cannot be merged.")

        if not skip_checks:
            checks_ok = self.pr_service.run_checks(pr_id)
            if not checks_ok:
                raise RuntimeError(
                    f"PR {pr_id} checks are failing or pending. Re-run with --skip-checks only if intentional."
                )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="orchestrator",
        description="Local AI orchestration CLI for kconecta-app",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    preflight_parser = subparsers.add_parser(
        "preflight",
        help="Validate local environment and required local models.",
    )
    preflight_parser.add_argument(
        "--fix-models",
        action="store_true",
        help="Pull missing required Ollama models.",
    )

    bootstrap_parser = subparsers.add_parser(
        "bootstrap-branches",
        help="Create agent branches and worktrees.",
    )
    bootstrap_parser.add_argument(
        "--base",
        default=DEFAULT_BASE_BRANCH,
        help=f"Base branch for agent branches (default: {DEFAULT_BASE_BRANCH}).",
    )

    run_task_parser = subparsers.add_parser(
        "run-task",
        help="Run a task through an agent.",
    )
    run_task_parser.add_argument("--agent", required=True, choices=sorted(AGENT_BRANCHES.keys()))
    run_task_parser.add_argument("--task-file", required=True)
    run_task_parser.add_argument("--dry-run", action="store_true")

    create_pr_parser = subparsers.add_parser(
        "create-pr",
        help="Push agent branch and open a draft PR.",
    )
    create_pr_parser.add_argument("--agent", required=True, choices=sorted(AGENT_BRANCHES.keys()))
    create_pr_parser.add_argument("--base", default=DEFAULT_BASE_BRANCH)

    approve_parser = subparsers.add_parser(
        "approve-merge",
        help="Record human approval for a PR.",
    )
    approve_parser.add_argument("--pr", required=True)

    merge_parser = subparsers.add_parser(
        "merge-pr",
        help="Merge an approved PR after validation checks.",
    )
    merge_parser.add_argument("--pr", required=True)
    merge_parser.add_argument("--skip-checks", action="store_true")

    return parser


def resolve_repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    orchestrator = Orchestrator(resolve_repo_root())

    if args.command == "preflight":
        result = orchestrator.preflight(fix_models=args.fix_models)
    elif args.command == "bootstrap-branches":
        result = orchestrator.bootstrap_branches(base_branch=args.base)
    elif args.command == "run-task":
        result = orchestrator.run_task(
            agent_name=args.agent,
            task_file=Path(args.task_file),
            dry_run=args.dry_run,
        )
    elif args.command == "create-pr":
        result = orchestrator.create_pr(agent_name=args.agent, base_branch=args.base)
    elif args.command == "approve-merge":
        result = orchestrator.approve_merge(pr_id=args.pr)
    elif args.command == "merge-pr":
        result = orchestrator.merge_pr(pr_id=args.pr, skip_checks=args.skip_checks)
    else:
        parser.error(f"Unsupported command: {args.command}")
        return 2

    print(json.dumps(result, indent=2, ensure_ascii=True))
    return 0
