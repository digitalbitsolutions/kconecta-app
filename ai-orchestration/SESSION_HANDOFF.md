# Session Handoff (2026-03-11)

## Current State

- Repository: `D:\still\kconecta-app`
- Branch: `main` synced with `origin/main`
- Executor policy: `AI_EXECUTOR=aider` (OpenClaw en observacion)
- Backend policy: Docker-only (sin XAMPP)
- Wave activa: `Wave 21 - Manager assignment context parity`
- Jira open (`statusCategory != Done`): `5` (`DEV-104..DEV-108`)
- Open PRs: `5` (`#89..#93`)

## Wave 21 Progress Snapshot

1. Epic and tickets created and visible in board:
   - `DEV-104` (epic/devops)
   - `DEV-105` (architect)
   - `DEV-106` (backend)
   - `DEV-107` (mobile)
   - `DEV-108` (qa)
2. Sprint alignment:
   - `DEV Wave 21` created/activated (`sprint_id=144` on board `1`)
   - All Wave 21 tickets assigned to sprint.
3. PRs draft abiertos:
   - `#89` `DEV-104` devops bootstrap/documentation
   - `#90` `DEV-105` architect contract/state map
   - `#91` `DEV-106` backend assignment-context endpoint + tests
   - `#92` `DEV-107` mobile assignment-context UI/API wiring
   - `#93` `DEV-108` QA regression matrix/documentation
4. Jira status:
   - `DEV-104`, `DEV-105`, `DEV-106`, `DEV-107`, `DEV-108` en `In Progress`
5. Board visibility:
   - Si board no muestra tarjetas, limpiar filtros de `Sprint/Assignee/Status` y seleccionar sprint activo `DEV Wave 21`.

## Known Blockers

- Aider apply mode can still timeout on long edits.
  - Current workaround: deterministic manual fallback in agent worktrees.
- Full Laravel PHPUnit end-to-end in this repo remains limited by `docker-compose.yml` (no app/php service).
  - Current workaround: PR-level CI gates and staged regression execution after merge.
- Host `php` still points to broken XAMPP runtime; keep it excluded from local test workflow.

## Resume Commands

```powershell
cd D:\still\kconecta-app
$env:GIT_CONFIG_COUNT=1
$env:GIT_CONFIG_KEY_0='safe.directory'
$env:GIT_CONFIG_VALUE_0='*'
$env:AI_EXECUTOR='aider'
$env:AIDER_EDIT_FORMAT='diff'
$env:AIDER_EXEC_TIMEOUT_SECONDS='600'
py ai-orchestration/orchestrator.py preflight
gh pr list --state open --limit 20
py ai-orchestration/orchestrator.py jira-list --status open --max-results 20
```

## Next Natural Actions

1. Review + approve + merge `#89..#93` to `main` in sequence.
2. Transition Jira Wave 21 tickets to `Done` after each merge.
3. Close epic `DEV-104` when all child tickets are `Done`.
4. Open Wave 22 (next parity slice) and repeat orchestration cycle.
