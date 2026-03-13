# AI Orchestration Roadmap (kconecta-app)

## Objective

Build a local AI software factory for the CRM ecosystem with isolated agent execution, controlled merges, and traceable delivery.

## Current Status (2026-03-13)

Completed:

- Multi-agent orchestration scaffold in `ai-orchestration/`.
- Agent isolation via branches + worktrees.
- Local-only model routing through Ollama.
- Aider integration for controlled file edits.
- Human approval gate before merge.
- MCP, RAG, and Skills v1.
- Docker local stack for backend runtime/tests (no XAMPP).
- Waves 1-25 completed and merged to `main`.
- Wave 26 delivery completed at ticket level:
  - `DEV-130` architect Done
  - `DEV-131` backend Done
  - `DEV-132` mobile Done (PR `#118` open draft)
  - `DEV-133` qa Done (PR `#119` open draft)
  - epic `DEV-129` Done

Platform hardening:

- Aider improvements in orchestrator:
  - shorter prompts per task,
  - automatic partitioning by `files_scope`,
  - adaptive retries/timeouts by agent.
- Executor routing:
  - `AI_EXECUTOR=auto` -> `aider` primary.
  - `openclaw` enabled as controlled fallback.

## Delivery Phases

### Phase 1: Foundation (Done)

- Stable orchestration CLI and branch policy.
- Baseline docs for architecture and API contract.
- Initial CI pipeline for backend/mobile checks.

### Phase 2: Backend Delivery (In Progress)

- Laravel contracts for manager/provider parity.
- Deterministic auth/role/error envelopes.
- Current focus moves to Wave 27 backend scope.

### Phase 3: Mobile Delivery (In Progress)

- React Native manager/providers scaffold in operation.
- Manager API flows integrated across dashboard/list/detail/handoff.
- Current focus moves to Wave 27 mobile scope.

### Phase 4: QA + Security (In Progress)

- Regression matrices added per wave.
- Wave 26 matrix added (`Wave26RegressionMatrixTest.php`).
- Continue enforcing deterministic guardrails in new waves.

### Phase 5: Release Orchestration (In Progress)

- CI checks + protected `main` + manual approval before merge.
- Continue PR-only workflow and traceability in Jira.

## Jira Tracking Model (Recommended)

Board workflow:

- `Backlog` -> `Selected for Development` -> `In Progress` -> `In Review` -> `Done`

Issue naming:

- `[agent] TASK-ID - Short title`

Labels:

- `ai-orchestration`
- `agent-architect|agent-backend|agent-mobile|agent-qa|agent-devops`
- `priority-high|priority-medium|priority-low`

Automation:

- Create issue from task file via `jira-create-from-task`.
- Link PRs with `jira-link-pr`.
- Transition issue when PR status changes.

## Next Milestones

1. Move PRs `#118` and `#119` to Ready and merge both.
2. Validate Jira board reflects full Wave 26 closure.
3. Open Wave 27 (epic + architect/backend/mobile/qa).
4. Execute full cycle architect -> backend -> mobile -> qa with draft PRs.
5. Keep Docker-only backend testing policy:
   - `py ai-orchestration/orchestrator.py backend-test-docker`

## Status Notes

- Main branch protection is active and direct push is rejected by policy.
- Aider timeout risk still exists for long tasks; manual worktree recovery remains the safe fallback.
- OpenClaw fallback is available but still under behavioral observation.
