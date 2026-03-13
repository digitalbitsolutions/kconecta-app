# AI Orchestration Roadmap (kconecta-app)

## Objective

Build a local AI software factory for the CRM ecosystem with isolated agent execution, controlled merges, and traceable delivery.

## Current Status (2026-03-13)

Completed:

- Multi-agent orchestration scaffold in `ai-orchestration/`.
- Agent isolation via branches + worktrees.
- Local Ollama runtime integrated for codegen fallback.
- Google AG integrated and now promoted as planning/review mitigation for long executor tasks.
- Aider retained as primary executor for file edits.
- OpenClaw available as controlled fallback when Aider fails.
- MCP, RAG, and Skills v1 active.
- Docker-only backend runtime/testing policy established (`NO XAMPP`).
- Waves 1-28 completed and merged to `main`.
- Wave 29 executed and ready for review:
  - `#131` architect ready
  - `#132` backend ready
  - `#133` mobile ready
  - `#134` qa ready
  - Jira transitions executed for `DEV-144..148`
- Wave 30 planning artifacts defined:
  - `wave30_epic_manager_provider_directory_task.json`
  - `architect_wave30_manager_provider_directory_contract_task.json`
  - `backend_wave30_manager_provider_directory_contract_task.json`
  - `mobile_wave30_manager_provider_directory_ux_task.json`
  - `qa_wave30_manager_provider_directory_regression_task.json`
  - `docs/roadmap/wave30-manager-provider-directory-plan.md`

Platform hardening:

- shorter executor prompts
- automatic `files_scope` partitioning
- adaptive retries/timeouts by agent
- runtime fallback `aider -> openclaw`
- Google AG used upstream of execution for contract decomposition and review

## Delivery Phases

### Phase 1: Foundation (Done)

- Stable orchestration CLI and branch policy.
- Baseline docs for architecture and API contract.
- Initial CI pipeline for backend/mobile checks.

### Phase 2: Backend Delivery (In Progress)

- Laravel contracts for manager/provider parity.
- Deterministic auth/role/error envelopes.
- Next focus: Wave 30 backend scope (manager provider directory/detail parity).

### Phase 3: Mobile Delivery (In Progress)

- React Native manager/providers scaffold operating.
- Manager flows integrated across dashboard/list/detail/handoff/editor.
- Next focus: Wave 30 mobile scope (manager provider directory/profile flow).

### Phase 4: QA + Security (In Progress)

- Regression matrices added per wave.
- QA now fails on contract drift once a contract is present.

### Phase 5: Release Orchestration (In Progress)

- CI checks + protected `main` + PR-only merges.
- Continue merge discipline and Jira traceability.

## Operational Policy

- `AI_EXECUTOR=aider` remains the default execution path.
- Google AG is the preferred assistant for:
  - planning,
  - task decomposition,
  - contract review,
  - mitigation of long Aider runs.
- OpenClaw is not primary; use it only as controlled runtime fallback.

## Next Milestones

1. Merge Wave 29 PRs `#131`, `#132`, `#133`, `#134`.
2. Open Wave 30 in Jira from the new task files.
3. Move `ARCH-024` to `In Progress` so the board shows active work again.
4. Execute Wave 30 architect -> backend -> mobile -> qa with Google AG-assisted planning and Aider execution.

## Status Notes

- Main branch protection is active and direct push is rejected by policy.
- No backend host testing is allowed; use Docker commands only.
- Aider timeout risk still exists, but mitigation is now explicit and layered.
