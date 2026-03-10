# TODO prioritario - Wave 21

Fecha: 2026-03-10  
Repo objetivo: `D:\still\kconecta-app`

## Estado

- Wave 20: cerrada (PRs `#84-#88` mergeadas, Jira `DEV-99..DEV-103` en `Done`).
- Siguiente objetivo: abrir y ejecutar Wave 21 con foco en contexto de asignacion manager-provider dentro de Property Detail.

## P0 (inmediato)

- [ ] Crear y registrar Wave 21 en Jira:
  - epic devops
  - architect contract
  - backend assignment context endpoint
  - mobile assignment context UI wiring
  - qa regression
- [ ] Mover architect/backend a `In Progress` para activar board visible.
- [ ] Ejecutar ciclo completo Wave 21 (`architect -> backend -> mobile -> qa`) con PR draft por agente.

## P1

- [ ] Validar en emulador Android manager:
  - tarjeta de contexto de asignacion en Property Detail
  - refresco de estado tras asignacion desde Handoff
- [ ] Definir adicion de servicio app/php en Docker Compose para PHPUnit end-to-end completo.

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
