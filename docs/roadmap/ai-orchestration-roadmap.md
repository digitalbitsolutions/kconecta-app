# AI Orchestration Roadmap (kconecta-app)

## Objective

Build a local AI software factory for the CRM ecosystem with isolated agent execution, controlled merges, and traceable delivery.

## Current Status (2026-03-14)

Completed:

- Multi-agent orchestration scaffold in `ai-orchestration/`.
- Agent isolation via branches + worktrees.
- Local-only model routing through Ollama.
- Aider integration for controlled file edits.
- Human approval gate before merge.
- MCP, RAG, and Skills v1.
- Docker local stack for DB (`kconecta-app` volume).
- Manager parity waves merged through Wave 31.
- `main` branch protection verified (`PR required`, direct push blocked).
- `Google AG` added as planning/review assistant to reduce `aider` load on large tasks.

## Delivery Phases

### Phase 1: Foundation (Done)

- Stable orchestration CLI and branch policy.
- Baseline docs for architecture and API contract.
- Initial CI pipeline for backend/mobile checks.

### Phase 2: Backend Delivery (In Progress)

- Laravel provider/property endpoints and service layer evolved in waves.
- Request validation and contract coverage expanded.
- Current focus: manager assignment lifecycle mutations in Wave 32.

### Phase 3: Mobile Delivery (In Progress)

- React Native manager app has:
  - auth/session bootstrap
  - dashboard summary + priorities
  - property list/detail/editor
  - provider directory/profile
  - provider handoff flow
  - assignment center + assignment detail
- Current focus: actionable assignment status transitions from the detail screen.

### Phase 4: QA + Security (In Progress)

- API regression matrices exist through Wave 31.
- Auth and access-control guardrails are covered in dedicated tests.
- Current focus: assignment status workflow regression matrix in Wave 32.

### Phase 5: Release Orchestration (In Progress)

- CI remains mandatory on all agent PRs.
- PR-only merge discipline is active.
- Operational focus: keep waves smaller, avoid PR drift, and minimize `aider` timeout recovery.

## Jira Tracking Model

Board workflow:

- `Backlog` -> `Selected for Development` -> `In Progress` -> `In Review` -> `Done`

Issue naming:

- `[agent] TASK-ID - Short title`

Labels:

- `ai-orchestration`
- `agent-architect|agent-backend|agent-mobile|agent-qa|agent-devops`
- `priority-high|priority-medium|priority-low`

## Executor Policy

- `aider`: primary file edit executor
- `Google AG`: planning, decomposition, review, contract reasoning
- `openclaw`: fallback only when `aider` fails and scope is tightly bounded

## Next Milestones

1. Open and execute Wave 32 end-to-end.
2. Keep `aider` prompts small and wave tasks narrowly scoped.
3. Continue manager parity from assignment inspection to assignment mutation/completion flows.
4. Preserve Docker-only backend validation path.
5. Keep Jira board states synchronized with active agent execution.
