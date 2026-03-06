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
- Jira integration v1 (optional) added to orchestrator CLI.

## Delivery Phases

### Phase 1: Foundation (Done)

- Stable orchestration CLI and branch policy.
- Baseline docs for architecture and API contract.
- Initial CI pipeline for backend/mobile checks.

### Phase 2: Backend Delivery

- Implement Laravel provider endpoints and service layer.
- Add request validation and response resources.
- Add migration-safe schema updates.
- Define API auth and role scopes against CRM backend.

### Phase 3: Mobile Delivery

- Expand React Native module structure.
- Add shared API client and typed models.
- Integrate auth/session handling and role-aware navigation.
- Implement providers, properties, and service-order flows.

### Phase 4: QA + Security

- Add API and mobile smoke tests.
- Add regression suites for critical business flows.
- Add security checks for auth and access control.

### Phase 5: Release Orchestration

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

1. Review and merge PR #5 (`backend`) and PR #6 (`qa`) after manual validation.
2. Add mandatory branch protection/check requirements for `main`.
3. Configure Jira credentials in `ai-orchestration/.env.jira` and create first issues from tasks.
4. Link PRs to Jira and enforce transition workflow (`In Progress` -> `In Review` -> `Done`).

Status update:

- Milestone 1 completed on 2026-03-06: PR #5 and PR #6 merged.
