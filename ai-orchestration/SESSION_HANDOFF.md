# Session Handoff (2026-03-14)

## Current State

- Repository: `D:\still\kconecta-app`
- Preferred execution workspace: clean agent worktrees under `.ai-worktrees\`
- `main` protection: enforced (`PR required`, direct push blocked)
- Backend runtime policy: Docker-only (`NO XAMPP`)
- Executor stack:
  - primary edit executor: `aider`
  - planning/reasoning helper: `Google AG`
  - controlled fallback: `openclaw` (only when `aider` fails)

## Wave Status Snapshot

- Waves 23-30: merged to `main`.
- Wave 31: merged and closed end-to-end.
  - `#135` devops
  - `#136` architect
  - `#137` backend
  - `#138` mobile
  - `#139` qa
  - Jira closed: `DEV-154`, `DEV-155`, `DEV-156`, `DEV-157`, `DEV-158`
- Next planned wave: Wave 32 - Manager assignment status management.

## What Was Executed In This Session

1. Linked and readied the missing QA PR `#139`.
2. Re-synced `agent/architect`, `agent/backend`, `agent/mobile`, and `agent/qa` against `origin/main`.
3. Resolved blocked review threads in `#136` and `#138`.
4. Merged the full Wave 31 PR sequence to `main`.
5. Updated Jira tickets and epic to `Done`.
6. Formalized `Google AG` as planner/reviewer support for future waves to reduce `aider` timeout pressure.

## Known Risks / Blockers

1. `aider` can still timeout on long prompts or broad file scopes.
   - active mitigation: shorter prompts, scoped task files, adaptive retries, manual recovery when required
2. `openclaw` may leave local untracked artifacts in worktrees:
   - `.openclaw/`
   - `AGENTS.md`, `HEARTBEAT.md`, `IDENTITY.md`, `SOUL.md`, `TOOLS.md`, `USER.md`
   - these are local artifacts and should be removed before branch sync/merge if they reappear
3. Root repo can contain unrelated stale task artifacts from abandoned waves.
   - prefer agent worktrees for real execution
   - do not assume root `git status` is clean

## Guardrails (Do Not Break)

- Never push directly to `main`.
- Always use `agent/*` branch -> PR -> review -> merge.
- Keep `NO XAMPP` policy.
- Use Docker for backend checks/tests.
- Never run `php artisan test` directly on host.
- Use `Google AG` for planning/review, not direct file edits.
- Avoid destructive Git commands.

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

1. Open Wave 32 in Jira from the new task files.
2. Transition the Wave 32 epic and architect ticket to `In Progress`.
3. Execute Wave 32 architect -> backend -> mobile -> qa.
4. Keep `Google AG` on planning/review and reserve `aider` for scoped edits only.
