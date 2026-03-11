# TODO prioritario - Wave 21 (ciclo en review)

Fecha: 2026-03-10  
Repo objetivo: `D:\still\kconecta-app`

## Estado

- Wave 20: cerrada (PRs `#84-#88` mergeadas, Jira `DEV-99..DEV-103` en `Done`).
- Wave 21: creada/activa y ejecutada end-to-end en ramas de agentes.
- PRs draft abiertos Wave 21:
  - `#89` (`DEV-104`) devops
  - `#90` (`DEV-105`) architect
  - `#91` (`DEV-106`) backend
  - `#92` (`DEV-107`) mobile
  - `#93` (`DEV-108`) qa

## P0 (inmediato)

- [x] Crear y registrar Wave 21 en Jira (epic + architect/backend/mobile/qa).
- [x] Mover Wave 21 a `In Progress` y dejar board visible.
- [x] Ejecutar ciclo completo Wave 21 (`architect -> backend -> mobile -> qa`) con PR draft por agente.
- [ ] Revisar/aprobar/mergear PRs `#89..#93`.
- [ ] Pasar `DEV-104..DEV-108` a `Done` al cerrar PRs.

## P1

- [ ] Validar en emulador Android manager:
  - tarjeta `Assignment context` en Property Detail
  - refresco de estado tras asignacion desde Handoff
- [ ] Diseñar `docker-compose` con servicio app/php para habilitar PHPUnit local end-to-end (sin XAMPP).

## Restricciones activas

- [x] No usar XAMPP.
- [x] Backend/testing por Docker.
- [x] No usar comandos destructivos.
- [x] Mantener `AI_EXECUTOR=aider`.

## Comandos base

```powershell
cd D:\still\kconecta-app
$env:AI_EXECUTOR='aider'
$env:AIDER_EDIT_FORMAT='diff'
$env:AIDER_EXEC_TIMEOUT_SECONDS='600'
py ai-orchestration/orchestrator.py preflight
gh pr list --state open --limit 20
py ai-orchestration/orchestrator.py jira-list --status open --max-results 20
```
