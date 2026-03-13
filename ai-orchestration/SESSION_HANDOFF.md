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

- Waves 22-28: completed and merged.
- Wave 29: executed end-to-end and left in `Ready for review`.
  - `DEV-146` (architect) -> Done, PR `#131`
  - `DEV-145` (backend) -> Done, PR `#132`
  - `DEV-148` (mobile) -> Done, PR `#133`
  - `DEV-147` (qa) -> Done, PR `#134`
  - Epic `DEV-144` -> Done

- Open PRs currently relevant:
  - `#131` `[architect] docs - define Wave 29 manager handoff evidence contract` (ready)
  - `#132` `[backend] feat - enrich Wave 29 provider assignment evidence` (ready)
  - `#133` `[mobile] DEV-148 / MOB-026 - consume wave29 handoff assignment evidence` (ready)
  - `#134` `[qa] DEV-147 / QA-028 - add wave29 manager handoff regression matrix` (ready)
  - `#120` `[devops] docs - refresh session context after Wave 26` (draft)
  - `#121` `[devops] chore - persist docker test policy and wave task artifacts` (draft)
  - `#122` `[devops] docs - define Wave 27 manager property form tasks` (draft)

## What Was Executed In This Session

1. Wave 29 architect contract landed in `agent/architect` and PR `#131`.
2. Wave 29 backend enriched assignment evidence landed in `agent/backend` and PR `#132`.
3. Wave 29 mobile handoff screen now consumes additive assignment evidence directly, avoids the second detail fetch, and landed in PR `#133`.
4. Wave 29 QA added:
   - testing strategy updates,
   - additive assignment evidence assertions in `PropertyApiTest.php`,
   - dedicated `Wave29RegressionMatrixTest.php`,
   - PR `#134`.
5. All four Wave 29 PRs are `Ready for review` with green checks.
6. Jira transitions executed to move `DEV-145..148` and epic `DEV-144` to `Done`.
7. Wave 30 task files + plan were defined in `agent/devops-context` for the next manager parity increment.

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

1. Approve/merge Wave 29 PRs `#131`, `#132`, `#133`, `#134`.
2. Open Wave 30 in Jira from the new task files:
   - epic `EPIC-W30`
   - architect `ARCH-024`
   - backend `BE-026`
   - mobile `MOB-027`
   - qa `QA-029`
3. Move `ARCH-024` to `In Progress` so the board shows active work again.
4. Keep Google AG for planning/review, `aider` for edits, and `openclaw` only as fallback.
