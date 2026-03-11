# TODO prioritario - Wave 21

Fecha: 2026-03-11  
Repo objetivo: `D:\still\kconecta-app`

## Estado actual

- Wave 21 abierta y activa en Jira.
- Tickets abiertos en `In Progress`: `DEV-104..DEV-108`.
- PRs draft abiertas para Wave 21: `#89..#93`.

## P0 (inmediato)

- [ ] Revisar y cerrar ciclo Wave 21 end-to-end:
  - `#89` DEV-104 (devops epic/docs)
  - `#90` DEV-105 (architect contract/state map)
  - `#91` DEV-106 (backend assignment-context endpoint)
  - `#92` DEV-107 (mobile wiring property detail)
  - `#93` DEV-108 (qa regression matrix)
- [ ] Aprobar/mergear PRs `#89..#93` a `main` respetando validaciones.
- [ ] Pasar Jira `DEV-104..DEV-108` a `Done` tras cada merge.
- [ ] Cerrar epic `DEV-104`.

## P1 (siguiente ola)

- [ ] Abrir Wave 22 en Jira (epic + architect/backend/mobile/qa).
- [ ] Arrancar architect/backend en `In Progress` para que el board muestre tarjetas activas.
- [ ] Ejecutar ciclo completo de Wave 22 con PRs draft y trazabilidad Jira.

## Bloqueos y mitigaciones

- [ ] Aider puede agotar timeout en prompts grandes.
  - Mitigacion: aumentar timeout y/o fallback manual controlado en worktrees.
- [ ] No hay servicio `app/php` en `docker-compose.yml` (solo `db` + `adminer`), limita PHPUnit end-to-end.
  - Mitigacion: agregar servicio PHP/Laravel para ejecutar `artisan test` dentro de Docker.

## Restricciones activas

- [x] No usar XAMPP (solo Docker).
- [x] No usar comandos destructivos de Git.
- [x] Mantener `AI_EXECUTOR=aider`.

## Comandos de reanudacion

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
