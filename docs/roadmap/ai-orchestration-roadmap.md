# AI Orchestration Roadmap (kconecta-app)

## Objective

Build a local AI software factory for the CRM ecosystem with isolated agent execution, controlled merges, and traceable delivery.

## Current Status (2026-03-06)

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
- Jira integration v1 (optional) added to orchestrator CLI.

## Delivery Phases

### Phase 1: Foundation (Done)

- Stable orchestration CLI and branch policy.
- Baseline docs for architecture and API contract.
- Initial CI pipeline for backend/mobile checks.

### Phase 2: Backend Delivery (In Progress)

- Implement Laravel provider endpoints and service layer.
- Add request validation and response resources.
- Add migration-safe schema updates.
- Define API auth and role scopes against CRM backend.

### Phase 3: Mobile Delivery (In Progress)

- Expand React Native module structure.
- Add shared API client and typed models.
- Integrate auth/session handling and role-aware navigation.
- Implement providers, properties, and service-order flows.

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

1. Implement real persistence for properties/providers using CRM production-compatible schema contracts (replace in-memory service stubs).
2. Connect manager app screens to live API client with auth/session and error handling.
3. Scaffold second mobile app (`apps/providers`) with role-specific navigation and service-order workflows.
4. Add mandatory branch protection rules in GitHub for `main` with required checks and review count.
5. Expand CI with API test job (`phpunit`) and React Native lint/test jobs as codebase matures.

Status update:

- Jira environment is active and workflow proven (`DEV-7` to `DEV-14` completed).
- Current repository baseline at main includes merged wave 1-3 outputs and is ready for wave 4 implementation.
