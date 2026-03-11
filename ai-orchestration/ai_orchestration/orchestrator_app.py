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
    DEFAULT_MAX_CHANGED_FILES,
    DEFAULT_MAX_CHANGED_LINES,
    DEFAULT_RAG_TOP_K,
    DEFAULT_WORKTREE_DIRNAME,
    LOG_FILE,
    MCP_CONFIG_FILE,
    RAG_CONFIG_FILE,
    REQUIRED_OLLAMA_MODELS,
    SEMANTIC_COMMIT_PREFIXES,
    SKILLS_DIR,
)
from .models import AgentExecutionContext, McpInvocationResult, RagSnippet, TaskSpec
from .services.aider_service import AiderService
from .services.approval_store import ApprovalStore
from .services.audit_logger import AuditLogger
from .services.command_runner import CommandRunner
from .services.executor_service import ExecutorService
from .services.git_service import GitService
from .services.google_ag_client import GoogleAgClient
from .services.jira_service import JiraService
from .services.llm_router import LlmRouter
from .services.mcp_service import LocalMcpService
from .services.openclaw_service import OpenClawService
from .services.ollama_client import OllamaClient
from .services.pr_service import PullRequestService
from .services.rag_service import RagService
from .services.skill_service import SkillService
from .services.task_service import TaskService
from .services.windsurf_client import WindsurfClient


class Orchestrator:
    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root
        self.worktree_root = self.repo_root / DEFAULT_WORKTREE_DIRNAME
        self._load_env_file(self.repo_root / "ai-orchestration" / ".env.llm")
        self.runner = CommandRunner()
        self.git = GitService(self.repo_root, runner=self.runner)
        self.ollama = OllamaClient(runner=self.runner)
        self.google_ag = GoogleAgClient()
        self.windsurf = WindsurfClient()
        self.llm_router = LlmRouter(
            ollama=self.ollama,
            google_ag=self.google_ag,
            windsurf=self.windsurf,
        )
        self.task_service = TaskService()
        self.audit = AuditLogger(self.repo_root / LOG_FILE)
        self.approval_store = ApprovalStore(self.repo_root / APPROVAL_STORE_FILE)
        self.aider = AiderService(runner=self.runner)
        self.openclaw = OpenClawService(runner=self.runner)
        self.executors = ExecutorService(aider=self.aider, openclaw=self.openclaw)
        self.pr_service = PullRequestService(self.git, runner=self.runner)
        self.skill_service = SkillService(self.repo_root / SKILLS_DIR)
        self.rag = RagService(self.repo_root, self.repo_root / RAG_CONFIG_FILE)
        self.jira = JiraService()
        self.mcp = LocalMcpService(
            repo_root=self.repo_root,
            config_file=self.repo_root / MCP_CONFIG_FILE,
            git=self.git,
            ollama=self.ollama,
            runner=self.runner,
        )

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
        report["checks"]["ollama_available"] = report["checks"]["ollama_health"]
        installed_models = self.ollama.list_models() if report["checks"]["ollama_health"] else set()
        report["checks"]["installed_models"] = sorted(installed_models)
        missing_models = sorted(
            model
            for model in REQUIRED_OLLAMA_MODELS
            if not self._model_is_available(model, installed_models)
        )
        report["checks"]["missing_models"] = missing_models

        report["checks"]["aider_command"] = self._resolve_aider_command()
        report["checks"]["aider_agent_policies"] = self.aider.all_policies_preview()
        report["checks"]["openclaw_command"] = self._resolve_openclaw_command()
        # Backward-compatible diagnostics key.
        report["checks"]["opencode_command"] = report["checks"]["openclaw_command"]
        report["checks"]["gh_available"] = self.pr_service.check_gh_available()
        report["checks"]["python_launcher"] = self.runner.run(
            ["py", "--version"], check=False
        ).stdout
        report["checks"]["mcp_servers"] = self.mcp.list_servers()
        report["checks"]["skills_available"] = [
            skill.to_dict() for skill in self.skill_service.list_skills()
        ]
        report["checks"]["rag_config_file"] = str(self.repo_root / RAG_CONFIG_FILE)
        report["checks"]["jira"] = self.jira.configuration_status()
        report["checks"]["llm_routing"] = self.llm_router.preflight_status()
        google_status = report["checks"]["llm_routing"]["providers"].get("google_ag", {})
        report["checks"]["google_ag_available"] = bool(google_status.get("healthy", False))
        report["checks"].update(self.executors.availability())

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

        context = self._build_agent_context(task)
        agent = create_agent(normalized_agent, self.llm_router)
        output = agent.execute(task, context=context)

        if dry_run:
            executor_status = self.executors.availability()
            payload = {
                "mode": "dry-run",
                "agent": normalized_agent,
                "task": task.to_dict(),
                "execution_context": context.to_dict(),
                "agent_output": output.to_dict(),
                "executor": executor_status.get("selected_executor"),
                "executor_availability": executor_status,
                "worktree": str(worktree),
                "branch": branch,
            }
            self.audit.log("run_task_dry_run", payload)
            return payload

        file_scope = self._resolve_file_scope(task=task, suggested=output.target_files)
        if not file_scope:
            raise RuntimeError(
                "Task has no file scope. For non dry-run execution provide files_scope in task file."
            )

        prompt = self._build_execution_prompt(task, output)
        executor_model = self._select_executor_model(task)
        execution_result = self.executors.apply_patch(
            worktree=worktree,
            prompt=prompt,
            files=file_scope,
            model=executor_model,
            agent_name=normalized_agent,
        )
        changed_files = self.git.changed_files(cwd=worktree)
        self._validate_changed_files_within_scope(changed_files, file_scope, worktree=worktree)
        diff_stats = self._validate_diff_limits(worktree=worktree, changed_files=changed_files)
        commit_message = self._normalize_commit_message(output.commit_message, task)
        committed_files = self.git.commit(
            cwd=worktree,
            message=commit_message,
            agent_name=normalized_agent,
        )

        transcript_file = self._save_transcript(
            task_id=task.id,
            agent_name=normalized_agent,
            transcript=execution_result.stdout
            + ("\n" + execution_result.stderr if execution_result.stderr else ""),
        )

        payload = {
            "mode": "apply",
            "agent": normalized_agent,
            "task_id": task.id,
            "execution_context": context.to_dict(),
            "branch": branch,
            "worktree": str(worktree),
            "changed_files": changed_files,
            "diff_stats": diff_stats,
            "committed_files": committed_files,
            "commit_message": commit_message,
            "executor": execution_result.selected_executor,
            "executor_model": executor_model,
            "executor_command": execution_result.command,
            "executor_fallback_from": execution_result.fallback_from,
            "executor_fallback_reason": execution_result.fallback_reason,
            "executor_transcript_file": str(transcript_file),
            "aider_policy": self.aider.preview_policy(normalized_agent)
            if execution_result.selected_executor == "aider"
            else None,
            "aider_command": execution_result.command
            if execution_result.selected_executor == "aider"
            else None,
            "aider_transcript_file": str(transcript_file)
            if execution_result.selected_executor == "aider"
            else None,
        }
        self.audit.log("run_task_apply", payload)
        return payload

    def _resolve_file_scope(self, *, task: TaskSpec, suggested: list[str]) -> list[str]:
        allowed = [item.replace("\\", "/").strip() for item in task.files_scope if item.strip()]
        if not allowed:
            return []

        if not suggested:
            return allowed

        allowed_set = set(allowed)
        scoped = []
        for item in suggested:
            normalized = item.replace("\\", "/").strip()
            if normalized in allowed_set:
                scoped.append(normalized)

        return scoped or allowed

    def _select_executor_model(self, task: TaskSpec) -> str:
        configured = task.metadata.get("executor_model")
        if isinstance(configured, str) and configured.strip():
            return configured.strip()

        if task.commit_type in {"docs", "test"}:
            return "mistral"

        return "deepseek-coder:6.7b"

    def create_pr(
        self,
        agent_name: str,
        base_branch: str = DEFAULT_BASE_BRANCH,
        issue_key: str | None = None,
    ) -> dict[str, Any]:
        normalized_agent = agent_name.strip().lower()
        if normalized_agent not in AGENT_BRANCHES:
            raise ValueError(
                f"Unknown agent '{agent_name}'. Expected: {', '.join(sorted(AGENT_BRANCHES.keys()))}"
            )

        normalized_issue = issue_key.strip().upper() if issue_key else None
        url = self.pr_service.create_draft_pr(
            normalized_agent,
            base_branch=base_branch,
            issue_key=normalized_issue,
        )
        payload = {
            "agent": normalized_agent,
            "branch": AGENT_BRANCHES[normalized_agent],
            "base": base_branch,
            "issue_key": normalized_issue,
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

    def list_skills(self, agent: str | None = None) -> dict[str, Any]:
        normalized_agent = agent.strip().lower() if agent else None
        skills = self.skill_service.list_skills(agent=normalized_agent)
        payload = {
            "agent_filter": normalized_agent,
            "skills": [item.to_dict() for item in skills],
        }
        self.audit.log("skills_list", payload)
        return payload

    def rag_search(
        self,
        query: str,
        *,
        top_k: int = DEFAULT_RAG_TOP_K,
        scope: list[str] | None = None,
    ) -> dict[str, Any]:
        snippets = self.rag.search(query=query, top_k=top_k, scope=scope or [])
        payload = {
            "query": query,
            "top_k": top_k,
            "scope": scope or [],
            "results": [item.to_dict() for item in snippets],
        }
        self.audit.log("rag_search", payload)
        return payload

    def mcp_list(self) -> dict[str, Any]:
        payload = {"servers": self.mcp.list_servers()}
        self.audit.log("mcp_list", payload)
        return payload

    def mcp_call(self, server: str, action: str, params: dict[str, Any]) -> dict[str, Any]:
        result = self.mcp.call(server=server, action=action, params=params)
        payload = {
            "server": server,
            "action": action,
            "params": params,
            "result": result,
        }
        self.audit.log("mcp_call", payload)
        return payload

    def jira_preflight(self) -> dict[str, Any]:
        payload = self.jira.preflight()
        self.audit.log("jira_preflight", payload)
        return payload

    def jira_create_from_task(
        self,
        *,
        task_file: Path,
        issue_type: str = "Task",
        labels: list[str] | None = None,
    ) -> dict[str, Any]:
        task = self.task_service.load(task_file)
        issue = self.jira.create_issue_from_task(
            task,
            issue_type=issue_type,
            labels=labels or [],
        )
        payload = {
            "task_file": str(task_file),
            "task_id": task.id,
            "agent": task.agent,
            "issue_type": issue_type,
            "issue": issue,
        }
        self.audit.log("jira_create_from_task", payload)
        return payload

    def jira_comment(self, issue: str, text: str) -> dict[str, Any]:
        result = self.jira.add_comment(issue, text)
        payload = {
            "issue": issue,
            "text": text,
            "result": result,
        }
        self.audit.log("jira_comment", payload)
        return payload

    def jira_link_pr(self, issue: str, pr_id: str) -> dict[str, Any]:
        pr_data = self.pr_service.view(pr_id)
        comment = (
            f"Linked PR #{pr_id}\n"
            f"Title: {pr_data.get('title', '(no title)')}\n"
            f"URL: {pr_data.get('url', '(no url)')}\n"
            f"Head: {pr_data.get('headRefName', '(unknown)')}\n"
            f"Base: {pr_data.get('baseRefName', '(unknown)')}"
        )
        result = self.jira.add_comment(issue, comment)
        payload = {
            "issue": issue,
            "pr_id": str(pr_id),
            "pr": pr_data,
            "result": result,
        }
        self.audit.log("jira_link_pr", payload)
        return payload

    def jira_transition(self, issue: str, to_status: str) -> dict[str, Any]:
        result = self.jira.transition_issue(issue, to_status)
        payload = {
            "issue": issue,
            "to": to_status,
            "result": result,
        }
        self.audit.log("jira_transition", payload)
        return payload

    def jira_list(
        self,
        *,
        agent: str | None = None,
        status: str = "open",
        max_results: int = 20,
    ) -> dict[str, Any]:
        payload = self.jira.list_issues(
            agent=(agent.strip().lower() if agent else None),
            status=status,
            max_results=max_results,
        )
        payload["agent_filter"] = agent
        payload["status_filter"] = status
        payload["max_results"] = max_results
        self.audit.log("jira_list", payload)
        return payload

    def backend_test_docker(
        self,
        *,
        backend_root: Path | None = None,
        phpunit_filter: str | None = None,
        ensure_env_file: bool = True,
    ) -> dict[str, Any]:
        requested_backend = self._resolve_backend_root(backend_root)
        resolved_backend = requested_backend
        compose_file = resolved_backend / "docker-compose.yml"
        if not compose_file.exists():
            raise FileNotFoundError(
                f"docker-compose.yml not found in backend root: {resolved_backend}"
            )

        fallback_applied = False
        fallback_reason: str | None = None
        fallback_backend_root: str | None = None
        try:
            app_service, db_service, available_services = self._resolve_compose_services(
                compose_file=compose_file,
                backend_root=resolved_backend,
            )
        except RuntimeError as exc:
            if "No PHP app service found in docker-compose.yml." not in str(exc):
                raise

            fallback_candidate = self._find_backend_root_with_php_service(
                exclude={resolved_backend.resolve()},
            )
            if fallback_candidate is None:
                raise RuntimeError(
                    f"{exc}\n"
                    "No fallback backend with PHP app service was found. "
                    "Set CRM_BACKEND_ROOT to your Laravel backend root or pass --backend-root."
                ) from exc

            fallback_applied = True
            fallback_reason = str(exc)
            fallback_backend_root = str(fallback_candidate)
            resolved_backend = fallback_candidate
            compose_file = resolved_backend / "docker-compose.yml"
            app_service, db_service, available_services = self._resolve_compose_services(
                compose_file=compose_file,
                backend_root=resolved_backend,
            )

        up_command = [
            "docker",
            "compose",
            "-f",
            str(compose_file),
            "up",
            "-d",
            app_service,
        ]
        if db_service:
            up_command.append(db_service)
        up_result = self.runner.run(up_command, cwd=resolved_backend, check=False, timeout=900)
        if up_result.returncode != 0:
            raise RuntimeError(
                f"Failed to start backend docker services in: {resolved_backend}\n"
                f"Requested backend root: {requested_backend}\n"
                f"Fallback applied: {fallback_applied}\n"
                f"stdout:\n{up_result.stdout}\n"
                f"stderr:\n{up_result.stderr}"
            )

        env_prepare_result = None
        if ensure_env_file:
            env_prepare_command = [
                "docker",
                "compose",
                "-f",
                str(compose_file),
                "exec",
                "-T",
                app_service,
                "sh",
                "-lc",
                "if [ ! -f .env ]; then cp .env.example .env; fi",
            ]
            env_prepare_result = self.runner.run(
                env_prepare_command,
                cwd=resolved_backend,
                check=False,
                timeout=300,
            )
            if env_prepare_result.returncode != 0:
                raise RuntimeError(
                    "Failed to ensure backend .env file inside app container.\n"
                    f"stdout:\n{env_prepare_result.stdout}\n"
                    f"stderr:\n{env_prepare_result.stderr}"
                )

        testing_overrides = {
            "APP_ENV": "testing",
            "CACHE_STORE": "array",
            "DB_CONNECTION": "sqlite",
            "DB_DATABASE": ":memory:",
            "SESSION_DRIVER": "array",
            "QUEUE_CONNECTION": "sync",
            "MAIL_MAILER": "array",
            "BROADCAST_CONNECTION": "null",
            "PULSE_ENABLED": "false",
            "TELESCOPE_ENABLED": "false",
            "NIGHTWATCH_ENABLED": "false",
        }
        test_command = [
            "docker",
            "compose",
            "-f",
            str(compose_file),
            "exec",
            "-T",
        ]
        for key, value in testing_overrides.items():
            test_command.extend(["-e", f"{key}={value}"])
        test_command.extend([app_service, "php", "artisan", "test"])
        if phpunit_filter:
            test_command.extend(["--filter", phpunit_filter])

        test_result = self.runner.run(
            test_command,
            cwd=resolved_backend,
            check=False,
            timeout=1800,
        )

        payload = {
            "requested_backend_root": str(requested_backend),
            "backend_root": str(resolved_backend),
            "fallback_applied": fallback_applied,
            "fallback_reason": fallback_reason,
            "fallback_backend_root": fallback_backend_root,
            "compose_file": str(compose_file),
            "app_service": app_service,
            "db_service": db_service,
            "available_services": sorted(available_services),
            "ensure_env_file": ensure_env_file,
            "phpunit_filter": phpunit_filter,
            "up_command": up_command,
            "up_returncode": up_result.returncode,
            "env_prepare_command": (
                env_prepare_result.command if env_prepare_result else None
            ),
            "env_prepare_returncode": (
                env_prepare_result.returncode if env_prepare_result else None
            ),
            "command": test_command,
            "returncode": test_result.returncode,
            "success": test_result.returncode == 0,
            "stdout": test_result.stdout,
            "stderr": test_result.stderr,
        }
        self.audit.log("backend_test_docker", payload)
        return payload

    def _validate_task_agent(self, task: TaskSpec, agent_name: str) -> None:
        if task.agent != agent_name:
            raise ValueError(
                f"Task agent mismatch. Task expects '{task.agent}', command received '{agent_name}'."
            )

    def _resolve_backend_root(self, explicit: Path | None = None) -> Path:
        candidates = self._candidate_backend_roots(explicit=explicit)

        for candidate in candidates:
            root = candidate.expanduser()
            if (root / "docker-compose.yml").exists():
                return root

        checked = ", ".join(str(path) for path in candidates)
        raise FileNotFoundError(
            "Could not resolve CRM backend root for Docker tests. "
            f"Checked: {checked}. "
            "Set CRM_BACKEND_ROOT or pass --backend-root."
        )

    def _candidate_backend_roots(self, explicit: Path | None = None) -> list[Path]:
        candidates: list[Path] = []
        if explicit:
            candidates.append(explicit)

        env_path = os.environ.get("CRM_BACKEND_ROOT", "").strip()
        if env_path:
            candidates.append(Path(env_path))

        candidates.append(self.repo_root.parent / "kconecta.com" / "web")
        candidates.append(Path(r"D:\still\kconecta.com\web"))
        return candidates

    def _find_backend_root_with_php_service(
        self,
        *,
        exclude: set[Path] | None = None,
    ) -> Path | None:
        excluded = {path.resolve() for path in (exclude or set())}
        for candidate in self._candidate_backend_roots():
            root = candidate.expanduser()
            if root.resolve() in excluded:
                continue
            compose_file = root / "docker-compose.yml"
            if not compose_file.exists():
                continue
            available = self._inspect_compose_services(
                compose_file=compose_file,
                backend_root=root,
            )
            if self._select_service(
                available=available,
                explicit=os.environ.get("CRM_APP_SERVICE", "").strip() or None,
                candidates=["app", "php", "backend"],
            ):
                return root
        return None

    def _inspect_compose_services(
        self,
        *,
        compose_file: Path,
        backend_root: Path,
    ) -> set[str]:
        services_result = self.runner.run(
            ["docker", "compose", "-f", str(compose_file), "config", "--services"],
            cwd=backend_root,
            check=False,
            timeout=120,
        )
        if services_result.returncode != 0:
            raise RuntimeError(
                "Failed to inspect docker compose services.\n"
                f"stdout:\n{services_result.stdout}\n"
                f"stderr:\n{services_result.stderr}"
            )

        return {
            line.strip()
            for line in services_result.stdout.splitlines()
            if line.strip()
        }

    def _resolve_compose_services(
        self,
        *,
        compose_file: Path,
        backend_root: Path,
    ) -> tuple[str, str | None, set[str]]:
        available = self._inspect_compose_services(
            compose_file=compose_file,
            backend_root=backend_root,
        )
        app_service = self._select_service(
            available=available,
            explicit=os.environ.get("CRM_APP_SERVICE", "").strip() or None,
            candidates=["app", "php", "backend"],
        )
        if not app_service:
            raise RuntimeError(
                "No PHP app service found in docker-compose.yml. "
                f"Available services: {sorted(available)}"
            )

        db_service = self._select_service(
            available=available,
            explicit=os.environ.get("CRM_DB_SERVICE", "").strip() or None,
            candidates=["mysql", "db", "database"],
        )
        return app_service, db_service, available

    def _select_service(
        self,
        *,
        available: set[str],
        explicit: str | None,
        candidates: list[str],
    ) -> str | None:
        if explicit:
            return explicit if explicit in available else None

        for candidate in candidates:
            if candidate in available:
                return candidate
        return None

    def _build_agent_context(self, task: TaskSpec) -> AgentExecutionContext:
        skills = self.skill_service.resolve_for_task(task)
        rag_snippets = self._resolve_rag_context(task)
        mcp_results = self._resolve_mcp_context(task)
        return AgentExecutionContext(
            skills=skills,
            rag_snippets=rag_snippets,
            mcp_results=mcp_results,
        )

    def _resolve_rag_context(self, task: TaskSpec) -> list[RagSnippet]:
        rag_meta = task.metadata.get("rag", {})
        if rag_meta is None:
            rag_meta = {}
        if rag_meta and not isinstance(rag_meta, dict):
            raise ValueError("Task metadata 'rag' must be an object.")

        enabled = bool(rag_meta.get("enabled", True))
        if not enabled:
            return []

        query = str(
            rag_meta.get("query")
            or f"{task.title}\n{task.description}\n{' '.join(task.acceptance_criteria)}"
        ).strip()
        if not query:
            return []

        top_k = int(rag_meta.get("top_k", DEFAULT_RAG_TOP_K))
        top_k = max(1, min(top_k, 8))

        scope = rag_meta.get("scope")
        if scope is None:
            scope = task.files_scope
        if scope is not None and not isinstance(scope, list):
            raise ValueError("Task metadata 'rag.scope' must be an array of paths.")

        scoped_results = self.rag.search(query=query, top_k=top_k, scope=scope)
        if scoped_results:
            return scoped_results

        if scope:
            return self.rag.search(query=query, top_k=top_k, scope=[])
        return scoped_results

    def _resolve_mcp_context(self, task: TaskSpec) -> list[McpInvocationResult]:
        requests = task.metadata.get("mcp_requests", [])
        if requests in (None, False):
            return []
        if requests and not isinstance(requests, list):
            raise ValueError("Task metadata 'mcp_requests' must be an array.")

        outputs: list[McpInvocationResult] = []
        for index, raw in enumerate(requests):
            if not isinstance(raw, dict):
                raise ValueError(f"MCP request at index {index} must be an object.")
            server = str(raw.get("server", "")).strip().lower()
            action = str(raw.get("action", "")).strip().lower()
            params = raw.get("params") or {}
            if not isinstance(params, dict):
                raise ValueError(f"MCP request params at index {index} must be an object.")
            if not server or not action:
                raise ValueError(f"MCP request at index {index} requires 'server' and 'action'.")

            result = self.mcp.call(server=server, action=action, params=params)
            outputs.append(
                McpInvocationResult(
                    server=server,
                    action=action,
                    params=params,
                    result=result,
                )
            )
        return outputs

    def _build_execution_prompt(self, task: TaskSpec, output: Any) -> str:
        prompt_limits = self._executor_prompt_limits(task)
        validation_text = self._format_prompt_list(
            output.validation_steps,
            limit=prompt_limits["validation_steps"],
            max_chars=prompt_limits["line_chars"],
        )
        acceptance_text = self._format_prompt_list(
            task.acceptance_criteria,
            limit=prompt_limits["acceptance_criteria"],
            max_chars=prompt_limits["line_chars"],
        )
        file_scope_text = self._format_prompt_list(
            (output.target_files or task.files_scope),
            limit=prompt_limits["file_scope"],
            max_chars=prompt_limits["line_chars"],
        )
        plan_summary = self._compact_prompt_line(
            output.plan_summary,
            max_chars=prompt_limits["plan_summary_chars"],
        )
        proposed_changes = self._compact_prompt_line(
            output.proposed_changes,
            max_chars=prompt_limits["proposed_changes_chars"],
        )
        return (
            "Edit files directly now. Do not ask follow-up questions.\n"
            f"Task: {task.id} - {task.title}\n"
            f"Goal: {self._compact_prompt_line(task.description, max_chars=220)}\n\n"
            f"Implementation intent: {plan_summary}\n"
            f"Proposed changes summary: {proposed_changes}\n\n"
            f"Allowed file scope:\n{file_scope_text}\n\n"
            f"Acceptance criteria:\n{acceptance_text}\n\n"
            f"Validation checks:\n{validation_text}\n\n"
            "Constraints:\n"
            "- Modify only files from Allowed file scope.\n"
            "- Preserve behavior outside this task.\n"
            "- Keep changes concise and production-ready.\n"
            "- Apply edits in-place and finish."
        )

    def _executor_prompt_limits(self, task: TaskSpec) -> dict[str, int]:
        defaults = {
            "file_scope": 8,
            "acceptance_criteria": 6,
            "validation_steps": 6,
            "line_chars": 180,
            "plan_summary_chars": 280,
            "proposed_changes_chars": 320,
        }
        if task.commit_type in {"docs", "test"}:
            defaults["file_scope"] = 6
            defaults["acceptance_criteria"] = 5
            defaults["validation_steps"] = 5
            defaults["proposed_changes_chars"] = 260

        if task.priority in {"high", "critical"}:
            defaults["acceptance_criteria"] = min(8, defaults["acceptance_criteria"] + 1)
            defaults["validation_steps"] = min(8, defaults["validation_steps"] + 1)

        metadata = task.metadata if isinstance(task.metadata, dict) else {}
        defaults["file_scope"] = self._clamp_prompt_limit(
            metadata.get("executor_prompt_file_scope_limit"),
            defaults["file_scope"],
            minimum=3,
            maximum=20,
        )
        defaults["acceptance_criteria"] = self._clamp_prompt_limit(
            metadata.get("executor_prompt_acceptance_limit"),
            defaults["acceptance_criteria"],
            minimum=3,
            maximum=20,
        )
        defaults["validation_steps"] = self._clamp_prompt_limit(
            metadata.get("executor_prompt_validation_limit"),
            defaults["validation_steps"],
            minimum=3,
            maximum=20,
        )
        defaults["line_chars"] = self._clamp_prompt_limit(
            metadata.get("executor_prompt_line_chars"),
            defaults["line_chars"],
            minimum=80,
            maximum=260,
        )
        defaults["plan_summary_chars"] = self._clamp_prompt_limit(
            metadata.get("executor_prompt_plan_chars"),
            defaults["plan_summary_chars"],
            minimum=120,
            maximum=600,
        )
        defaults["proposed_changes_chars"] = self._clamp_prompt_limit(
            metadata.get("executor_prompt_changes_chars"),
            defaults["proposed_changes_chars"],
            minimum=120,
            maximum=800,
        )
        return defaults

    def _format_prompt_list(self, items: list[str], *, limit: int, max_chars: int) -> str:
        cleaned = [item for item in (items or []) if str(item).strip()]
        if not cleaned:
            return "- none"

        truncated_items = cleaned[:limit]
        lines = [f"- {self._compact_prompt_line(item, max_chars=max_chars)}" for item in truncated_items]
        omitted = len(cleaned) - len(truncated_items)
        if omitted > 0:
            lines.append(f"- ... +{omitted} more item(s) omitted for latency")
        return "\n".join(lines)

    def _compact_prompt_line(self, value: str, *, max_chars: int) -> str:
        normalized = " ".join(str(value or "").replace("\r", " ").replace("\n", " ").split())
        if not normalized:
            return "none"
        if len(normalized) <= max_chars:
            return normalized
        return normalized[: max_chars - 3] + "..."

    def _clamp_prompt_limit(
        self,
        raw_value: Any,
        default: int,
        *,
        minimum: int,
        maximum: int,
    ) -> int:
        if raw_value in (None, ""):
            return default
        try:
            value = int(raw_value)
        except (TypeError, ValueError):
            return default
        return max(minimum, min(value, maximum))

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

    def _resolve_openclaw_command(self) -> str:
        try:
            command = self.openclaw.resolve_command()
            return " ".join(command)
        except Exception as exc:
            return f"(not available) {exc}"

    def _resolve_opencode_command(self) -> str:
        # Backward-compatible alias.
        return self._resolve_openclaw_command()

    def _load_env_file(self, env_path: Path) -> None:
        try:
            if not env_path.exists():
                return
            for raw_line in env_path.read_text(encoding="utf-8-sig").splitlines():
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", maxsplit=1)
                key = key.strip()
                value = value.strip().strip("\"'")
                if key and key not in os.environ:
                    os.environ[key] = value
        except OSError:
            return

    def _validate_changed_files_within_scope(
        self,
        changed_files: list[str],
        file_scope: list[str],
        *,
        worktree: Path,
    ) -> None:
        if not changed_files:
            return

        allowed = {path.replace("\\", "/").strip() for path in file_scope}
        out_of_scope: list[str] = []
        for path in changed_files:
            normalized = path.replace("\\", "/").strip()
            if normalized in allowed:
                continue

            absolute = worktree / normalized
            is_directory = normalized.endswith("/") or absolute.is_dir()
            if is_directory:
                prefix = normalized if normalized.endswith("/") else normalized + "/"
                if any(candidate.startswith(prefix) for candidate in allowed):
                    continue

            out_of_scope.append(path)

        if out_of_scope:
            raise RuntimeError(
                "Executor changed files outside allowed scope: " + ", ".join(out_of_scope)
            )

    def _validate_diff_limits(
        self,
        *,
        worktree: Path,
        changed_files: list[str],
    ) -> dict[str, int]:
        stats = self.git.diff_stats(cwd=worktree)
        max_files = self._env_int("AI_MAX_DIFF_FILES", DEFAULT_MAX_CHANGED_FILES)
        max_lines = self._env_int("AI_MAX_DIFF_LINES", DEFAULT_MAX_CHANGED_LINES)
        allow_large = (
            os.environ.get("AI_ALLOW_LARGE_DIFF", "").strip().lower() in {"1", "true", "yes", "on"}
        )

        files_over = len(changed_files) > max_files
        lines_over = stats["total_changed_lines"] > max_lines
        if (files_over or lines_over) and not allow_large:
            raise RuntimeError(
                "Large uncontrolled diff detected. "
                f"changed_files={len(changed_files)} (limit {max_files}), "
                f"total_changed_lines={stats['total_changed_lines']} (limit {max_lines}). "
                "Set AI_ALLOW_LARGE_DIFF=true only if intentional."
            )
        return stats

    def _env_int(self, key: str, default: int) -> int:
        raw = os.environ.get(key, "").strip()
        if not raw:
            return default
        try:
            value = int(raw)
        except ValueError:
            return default
        return max(1, value)

    def _normalize_commit_message(self, candidate: str, task: TaskSpec) -> str:
        fallback = f"{task.commit_type}: {task.title}"
        normalized = (candidate or "").strip()
        if not normalized:
            return fallback

        if ":" not in normalized:
            return fallback

        prefix, body = normalized.split(":", maxsplit=1)
        prefix = prefix.strip().lower()
        body = body.strip() or task.title
        if prefix not in SEMANTIC_COMMIT_PREFIXES:
            return fallback

        if prefix != task.commit_type:
            return f"{task.commit_type}: {body}"
        return f"{prefix}: {body}"

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
    create_pr_parser.add_argument(
        "--issue",
        required=False,
        help="Optional Jira issue key (for example DEV-72) to prefix PR title.",
    )

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

    skills_parser = subparsers.add_parser(
        "skills-list",
        help="List available local skills.",
    )
    skills_parser.add_argument("--agent", required=False)

    rag_parser = subparsers.add_parser(
        "rag-search",
        help="Search local repository context using RAG scoring.",
    )
    rag_parser.add_argument("--query", required=True)
    rag_parser.add_argument("--top-k", type=int, default=DEFAULT_RAG_TOP_K)
    rag_parser.add_argument("--scope", nargs="*", default=[])

    mcp_list_parser = subparsers.add_parser(
        "mcp-list",
        help="List available local MCP servers and actions.",
    )
    mcp_list_parser.set_defaults(_placeholder=True)

    mcp_call_parser = subparsers.add_parser(
        "mcp-call",
        help="Call a local MCP action.",
    )
    mcp_call_parser.add_argument("--server", required=True)
    mcp_call_parser.add_argument("--action", required=True)
    mcp_call_parser.add_argument(
        "--params",
        default="{}",
        help="JSON object for action params (default: {}).",
    )
    mcp_call_parser.add_argument(
        "--params-file",
        required=False,
        help="Path to JSON file with MCP params (alternative to --params).",
    )

    jira_preflight_parser = subparsers.add_parser(
        "jira-preflight",
        help="Validate Jira credentials and project access.",
    )
    jira_preflight_parser.set_defaults(_placeholder=True)

    jira_create_parser = subparsers.add_parser(
        "jira-create-from-task",
        help="Create a Jira issue from a task JSON/YAML file.",
    )
    jira_create_parser.add_argument("--task-file", required=True)
    jira_create_parser.add_argument("--issue-type", default="Task")
    jira_create_parser.add_argument("--labels", nargs="*", default=[])

    jira_comment_parser = subparsers.add_parser(
        "jira-comment",
        help="Add a Jira comment to an issue.",
    )
    jira_comment_parser.add_argument("--issue", required=True)
    jira_comment_parser.add_argument("--text", required=True)

    jira_link_pr_parser = subparsers.add_parser(
        "jira-link-pr",
        help="Add PR reference comment to a Jira issue.",
    )
    jira_link_pr_parser.add_argument("--issue", required=True)
    jira_link_pr_parser.add_argument("--pr", required=True)

    jira_transition_parser = subparsers.add_parser(
        "jira-transition",
        help="Transition a Jira issue by transition ID or name.",
    )
    jira_transition_parser.add_argument("--issue", required=True)
    jira_transition_parser.add_argument("--to", required=True)

    jira_list_parser = subparsers.add_parser(
        "jira-list",
        help="List Jira issues for project and optional agent/status filters.",
    )
    jira_list_parser.add_argument("--agent", required=False)
    jira_list_parser.add_argument("--status", default="open")
    jira_list_parser.add_argument("--max-results", type=int, default=20)

    backend_test_parser = subparsers.add_parser(
        "backend-test-docker",
        help="Run Laravel backend tests via Docker (no local/XAMPP PHP runtime).",
    )
    backend_test_parser.add_argument(
        "--backend-root",
        required=False,
        help=(
            "Path to CRM backend root with docker-compose.yml. "
            "If omitted, uses CRM_BACKEND_ROOT or default sibling path."
        ),
    )
    backend_test_parser.add_argument(
        "--filter",
        required=False,
        help="Optional phpunit filter expression.",
    )
    backend_test_parser.add_argument(
        "--skip-ensure-env",
        action="store_true",
        help="Skip creating .env inside app container when missing.",
    )

    return parser


def resolve_repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    orchestrator = Orchestrator(resolve_repo_root())
    exit_code = 0
    try:
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
            result = orchestrator.create_pr(
                agent_name=args.agent,
                base_branch=args.base,
                issue_key=args.issue,
            )
        elif args.command == "approve-merge":
            result = orchestrator.approve_merge(pr_id=args.pr)
        elif args.command == "merge-pr":
            result = orchestrator.merge_pr(pr_id=args.pr, skip_checks=args.skip_checks)
        elif args.command == "skills-list":
            result = orchestrator.list_skills(agent=args.agent)
        elif args.command == "rag-search":
            result = orchestrator.rag_search(
                query=args.query,
                top_k=args.top_k,
                scope=args.scope,
            )
        elif args.command == "mcp-list":
            result = orchestrator.mcp_list()
        elif args.command == "mcp-call":
            params = _parse_json_params(args.params, params_file=args.params_file)
            result = orchestrator.mcp_call(
                server=args.server,
                action=args.action,
                params=params,
            )
        elif args.command == "jira-preflight":
            result = orchestrator.jira_preflight()
        elif args.command == "jira-create-from-task":
            result = orchestrator.jira_create_from_task(
                task_file=Path(args.task_file),
                issue_type=args.issue_type,
                labels=args.labels,
            )
        elif args.command == "jira-comment":
            result = orchestrator.jira_comment(
                issue=args.issue,
                text=args.text,
            )
        elif args.command == "jira-link-pr":
            result = orchestrator.jira_link_pr(
                issue=args.issue,
                pr_id=args.pr,
            )
        elif args.command == "jira-transition":
            result = orchestrator.jira_transition(
                issue=args.issue,
                to_status=args.to,
            )
        elif args.command == "jira-list":
            result = orchestrator.jira_list(
                agent=args.agent,
                status=args.status,
                max_results=args.max_results,
            )
        elif args.command == "backend-test-docker":
            backend_root = Path(args.backend_root) if args.backend_root else None
            result = orchestrator.backend_test_docker(
                backend_root=backend_root,
                phpunit_filter=args.filter,
                ensure_env_file=not args.skip_ensure_env,
            )
            if not result.get("success", False):
                exit_code = 1
        else:
            parser.error(f"Unsupported command: {args.command}")
            return 2
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, indent=2, ensure_ascii=True))
        return 1

    print(json.dumps(result, indent=2, ensure_ascii=True))
    return exit_code


def _parse_json_params(raw: str, *, params_file: str | None = None) -> dict[str, Any]:
    if params_file:
        text = Path(params_file).read_text(encoding="utf-8-sig")
    else:
        text = (raw or "").strip() or "{}"
    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise ValueError("--params must be a JSON object.")
    return parsed
