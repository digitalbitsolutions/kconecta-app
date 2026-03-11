# Session Handoff (2026-03-11)

## Current State

- Repository: `D:\still\kconecta-app`
- Branch: `main` synced with `origin/main`
- Main protection: enforced (`PR required`, no direct push to `main`)
- Executor policy: `AI_EXECUTOR=aider` (OpenClaw in observation)
- Backend runtime policy: Docker-only (`NO XAMPP`)
- Active wave: `Wave 22 - Manager portfolio filter + pagination parity`

## Wave 22 Snapshot

- Jira tickets:
  - `DEV-109` (devops) -> `In Progress`
  - `DEV-110` (architect) -> `In Progress`
  - `DEV-111` (backend / BE-020) -> `In Progress`
  - `DEV-112` (mobile / MOB-019) -> `In Progress`
  - `DEV-113` (qa / QA-021) -> `In Progress`
- Open PRs:
  - `#95` `DEV-110` architect (DRAFT)
  - `#96` `DEV-111` backend (READY FOR REVIEW)
  - `#97` `DEV-109` devops (DRAFT)
  - `#98` `DEV-112` mobile (READY FOR REVIEW)
  - `#99` `DEV-113` qa (DRAFT)

## What Was Executed In This Session

1. `BE-020` executed with Aider (real run):
   - Full orchestrator task with `diff` format keeps timing out.
   - Partitioned/minimal Aider runs executed.
   - Aider completed successfully using `whole` format + `--map-tokens 0` and confirmed backend already aligned (no extra delta required).
2. Mobile (`DEV-112`) completed and pushed:
   - commit on `agent/mobile`: `feat: add wave22 manager portfolio filters and pagination ui`
   - PR `#98` marked ready for review.
3. QA (`DEV-113`) implemented and pushed:
   - commit on `agent/qa`: `test: add wave22 manager portfolio regression matrix`
   - PR `#99` created as draft.
4. Jira updates:
   - `DEV-111` comment added with Aider execution evidence.
   - `DEV-112` transitioned/commented with PR + validation evidence.
   - `DEV-113` commented with QA status + Docker blocker.

## Known Blockers

1. Docker Desktop engine API currently failing from CLI:
   - error pattern: HTTP 500 on `//./pipe/dockerDesktopLinuxEngine/...`
   - impact: containerized php lint/test execution blocked in this shell.
2. Aider reliability on long prompts:
   - `diff` edit format + larger scope tends to timeout.
   - lightweight models may fail edit-format conformance.

## Aider Stable Settings (Current Best)

- Prefer partitioned tasks (small file scope).
- Use:
  - `AIDER_EDIT_FORMAT=whole` for problematic tasks.
  - `--map-tokens 0` (or equivalent) to reduce latency.
  - short focused prompt, minimal files.

## Guardrails (Do Not Break)

- Never push directly to `main`.
- Always use `agent/*` branch -> PR -> review -> merge.
- Keep `NO XAMPP` policy.
- Keep non-destructive Git operations only.

## Resume Commands

```powershell
cd D:\still\kconecta-app
$env:GIT_CONFIG_COUNT=1
$env:GIT_CONFIG_KEY_0='safe.directory'
$env:GIT_CONFIG_VALUE_0='*'
$env:AI_EXECUTOR='aider'
$env:AIDER_EDIT_FORMAT='whole'
$env:AIDER_EXEC_TIMEOUT_SECONDS='180'
$env:AIDER_TOTAL_TIMEOUT_SECONDS='900'
$env:AIDER_BATCH_SIZE='1'
$env:AIDER_PROMPT_MAX_CHARS='1600'
py ai-orchestration/orchestrator.py preflight
gh pr list --state open --limit 20
py ai-orchestration/orchestrator.py jira-list --status open --max-results 20
```

## Next Natural Actions

1. Review/approve/merge `#96` (backend) and transition `DEV-111` to `Done`.
2. Review/approve/merge `#98` (mobile) and transition `DEV-112` to `Done`.
3. Fix Docker engine pipe issue, then run QA validations and move `#99` out of draft.
4. Merge `#95` and `#97` after validation and close Wave 22 epic path.
