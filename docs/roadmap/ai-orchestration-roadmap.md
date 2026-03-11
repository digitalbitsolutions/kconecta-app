# AI Orchestration Roadmap (kconecta-app)

## Objective

Build a local AI software factory for the CRM ecosystem with isolated agent execution, controlled merges, and traceable delivery.

## Current Status (2026-03-11)

Completed:

- Multi-agent orchestration scaffold in `ai-orchestration/`.
- Agent isolation via branches + worktrees.
- Local-only model routing through Ollama.
- Aider integration for controlled file edits.
- Human approval gate before merge.
- MCP, RAG, and Skills v1.
- Docker local stack for DB (`kconecta-app` volume).
- Initial PR wave merged:
  - PR #1 backend docs
  - PR #2 devops CI
  - PR #3 mobile scaffold
  - PR #4 architecture docs
- Wave 2 merged:
  - PR #5 backend provider API
  - PR #6 QA provider/auth smoke tests
  - PR #7 mobile UI/UX baseline
- Wave 3 merged:
  - PR #8 architecture multi-app strategy
  - PR #9 backend property API skeleton
  - PR #10 manager mobile dashboard and property flows
  - PR #11 QA property API smoke tests
  - PR #12 devops dockerized PHP lint in CI
  - PR #13 wave 3 task definitions tracked
  - PR #14 orchestration log/roadmap update
- Wave 4 merged:
  - PR #17 backend property detail endpoint
  - PR #16 QA property detail tests
  - PR #15 manager app API client integration
- Wave 5-8 merged:
  - PR #19, #21, #22, #20 release env + token gate
  - PR #23, #24, #25, #26 providers integration
  - PR #27, #28 functional test strategy and API flow tests
  - PR #29, #30, #31, #32 bugfix and regression hardening
  - PR #33 release notes publication
- Jira integration v1 (optional) added to orchestrator CLI.
- Wave 9 started:
  - DB-first provider/property retrieval with fallback controls.
  - API `meta.source` contract in list endpoints.
  - QA smoke suite aligned with data-source metadata.
- Waves 10-16 completed and merged to `main` (manager parity foundation).
- Wave 22 opened (manager portfolio filters + pagination parity):
  - Jira: `DEV-109..DEV-113`
  - Open PRs: `#95`, `#96`, `#97` (draft)
- Aider hardening applied in orchestrator:
  - shorter execution prompts per task
  - automatic change partitioning by files scope
  - adaptive timeout/retry policy by agent
  - policy visibility in `preflight` via `aider_agent_policies`

## Delivery Phases

### Phase 1: Foundation (Done)

- Stable orchestration CLI and branch policy.
- Baseline docs for architecture and API contract.
- Initial CI pipeline for backend/mobile checks.

### Phase 2: Backend Delivery (In Progress)

- Implement Laravel provider/property endpoints and service layer.
- Add request validation and response resources.
- Add migration-safe schema updates.
- Define API auth and role scopes against CRM backend.
- Current focus: Wave 22 backend filters and pagination metadata (`BE-020`).

### Phase 3: Mobile Delivery (In Progress)

- Expand React Native module structure.
- Add shared API client and typed models. (Done for manager property flows)
- Integrate auth/session handling and role-aware navigation. (Pending)
- Implement providers, properties, and service-order flows.
- Current focus: Wave 22 portfolio filters/pagination UI wiring (`MOB-019`).

### Phase 4: QA + Security (In Progress)

- Add API and mobile smoke tests.
- Add regression suites for critical business flows.
- Add security checks for auth and access control.

### Phase 5: Release Orchestration (In Progress)

- Harden CI with mandatory checks for all agent PRs.
- Add release tagging and changelog generation.
- Define rollback procedures and staging validation gates.

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

1. Close Wave 22 end-to-end (`DEV-109..DEV-113`) with PR merge + Jira transitions.
2. Resolve remaining mobile timeout risk (`MOB-019`) via policy tuning or task split.
3. Continue manager parity waves after filters/pagination baseline.
4. Keep Docker-only backend runtime for tests (no XAMPP path).
5. Maintain PR-only merge discipline on protected `main`.

Status update:

- Jira environment remains active and board/timeline tracking is stable.
- Main branch protection is enforced and validated (direct push rejected by rule).
- Repository baseline includes merged waves through Wave 16.
- Wave 22 is active and visible in board (`In Progress` + `To Do`).
