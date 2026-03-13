# Session Handoff (2026-03-13)

## Current State

- Repository: `D:\still\kconecta-app`
- Base branch policy: `main` protected (`PR required`, direct push blocked)
- Backend runtime policy: Docker-only (`NO XAMPP`)
- Execution policy:
  - primary executor: `AI_EXECUTOR=aider`
  - runtime fallback: `aider -> openclaw`
  - OpenClaw remains controlled fallback, not primary
- LLM mitigation policy:
  - Google AG is now the preferred planner/reviewer for long tasks, contract decomposition, and scoped review before executor runs
  - Ollama remains the local codegen/default fallback provider

## Progress Snapshot

- Waves 22-27: completed and merged.
- Wave 27 merged sequence:
  - `DEV-135` (architect) -> Done, PR `#123`
  - `DEV-134` (backend) -> Done, PR `#124`
  - `DEV-136` (mobile) -> Done, PR `#125`
  - `DEV-137` (qa) -> Done, PR `#126`
  - Epic `DEV-138` -> Done

- Open PRs currently relevant:
  - `#120` `[devops] docs - refresh session context after Wave 26` (draft)
  - `#121` `[devops] chore - persist docker test policy and wave task artifacts` (draft)
  - `#122` `[devops] docs - define Wave 27 manager property form tasks` (draft)

## What Was Executed In This Session

1. Cleaned `agent/architect` worktree from stray OpenClaw artifacts.
2. Fixed `#123` review feedback:
   - `meta.flow` aligned to `properties_create|properties_update`
   - conflict code aligned to `PROPERTY_STATE_CONFLICT`
   - rollout wording clarified so enriched fields stay additive during rollout
3. Fixed `#124` backend pricing semantics:
   - derived price no longer falls back to stale legacy `price` during edit recalculation
   - DB row mapping now prefers explicit sale/rent/garage pricing before legacy scalar fallback
4. Fixed `#125` mobile property editor behavior:
   - edit flow no longer silently defaults nullable `propertyType` / `operationMode`
   - canonical `price` now derives from selected `operationMode`
5. Fixed `#126` QA readiness gate:
   - readiness checks contract availability only
   - validation/message drift now fails the suite instead of being skipped
6. Resolved all review threads and merged `#123`, `#124`, `#125`, `#126`.
7. Verified Jira clean after merge: no open Wave 27 issues remained.

## Known Risks / Blockers

1. Aider can still timeout on long/scoped tasks.
   - mitigation path:
     - shorter prompts,
     - partition by `files_scope`,
     - adaptive retries/timeouts,
     - Google AG for plan/review before execution,
     - manual scoped recovery in agent worktree if needed
2. OpenClaw fallback can create noisy untracked files (`.openclaw/*` and companion docs).
   - recovery: clean only the affected worktree before continuing
3. Docker QA command can report `No tests found` when filter targets backend repo test set mismatch.
   - verify backend path and test namespace before trusting filtered output

## Guardrails (Do Not Break)

- Never push directly to `main`.
- Always use `agent/*` branch -> PR -> review -> merge.
- Keep `NO XAMPP` policy.
- Use Docker for backend checks/tests.
- Never run `php artisan test` directly on host.
- Required backend test command: `py ai-orchestration/orchestrator.py backend-test-docker`.

## Resume Commands

```powershell
cd D:\still\kconecta-app
$env:GIT_CONFIG_COUNT=1
$env:GIT_CONFIG_KEY_0='safe.directory'
$env:GIT_CONFIG_VALUE_0='*'
$env:AI_EXECUTOR='aider'
py ai-orchestration/orchestrator.py preflight
gh pr list --state open --limit 20
py ai-orchestration/orchestrator.py jira-list --status open --max-results 20
```

## Next Natural Actions

1. Define Wave 28 (epic + architect/backend/mobile/qa).
2. Use Google AG to decompose the next manager parity increment before execution.
3. Keep `AI_EXECUTOR=aider` as primary executor and `openclaw` as controlled fallback only.
4. Reconfirm Jira board shows the new wave in `To Do` / `In Progress` before starting execution.
