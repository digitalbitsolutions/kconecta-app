# Session Handoff (2026-03-11)

## Current State

- Repository: `D:\still\kconecta-app`
- Branch: `main` synced with `origin/main`
- Executor policy: `AI_EXECUTOR=aider` (OpenClaw en observacion)
- Backend policy: Docker-only (sin XAMPP)
- Wave activa: `Wave 21 - Manager assignment context parity`
- Jira open (`statusCategory != Done`): `5` (`DEV-104..DEV-108`, todos en `In Progress`)
- Open PRs: `5` (`#89..#93`, todos en `DRAFT`)

## Wave 21 Progress Snapshot

1. Epic + tickets Jira creados:
   - `DEV-104` epic/devops
   - `DEV-105` architect
   - `DEV-106` backend
   - `DEV-107` mobile
   - `DEV-108` qa
2. Sprint board:
   - `DEV Wave 21` activo (board id `1`, sprint id `144`)
   - Todos los tickets Wave 21 asignados al sprint y en `In Progress`
3. PRs draft abiertos:
   - `#89` `DEV-104` devops bootstrap/docs
   - `#90` `DEV-105` architect contract/state map
   - `#91` `DEV-106` backend assignment-context endpoint + tests
   - `#92` `DEV-107` mobile assignment-context UI/API wiring
   - `#93` `DEV-108` QA regression matrix

## Known Blockers

- Aider apply mode puede timeout en tareas largas.
  - Workaround: fallback manual controlado en worktrees de agente.
- PHPUnit Laravel end-to-end local sigue limitado por `docker-compose.yml` (solo `db` + `adminer`, sin servicio app/php).
- Host `php` local apunta a runtime XAMPP roto y debe ignorarse (politica: no usar XAMPP).

## Resume Commands (post-restart)

```powershell
cd D:\still\kconecta-app
$env:GIT_CONFIG_COUNT=1
$env:GIT_CONFIG_KEY_0='safe.directory'
$env:GIT_CONFIG_VALUE_0='*'
$env:AI_EXECUTOR='aider'
$env:AIDER_EDIT_FORMAT='diff'
$env:AIDER_EXEC_TIMEOUT_SECONDS='600'
$env:AIDER_TOTAL_TIMEOUT_SECONDS='900'
py ai-orchestration/orchestrator.py preflight
gh pr list --state open --limit 20
py ai-orchestration/orchestrator.py jira-list --status open --max-results 20
```

## Next Natural Actions

1. Revisar/aprobar/mergear PRs `#89..#93` a `main`.
2. Transicionar Jira `DEV-104..DEV-108` a `Done` al cerrar cada PR.
3. Cerrar epic `DEV-104`.
4. Abrir `Wave 22` (nuevo epic + 4 tickets) y arrancar ciclo architect -> backend -> mobile -> qa.
