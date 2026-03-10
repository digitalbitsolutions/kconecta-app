# TODO prioritario - Wave 20

Fecha: 2026-03-10  
Repo objetivo: `D:\still\kconecta-app`

## Estado

- Wave 19: cerrada (PRs `#80-#83` mergeadas, Jira `DEV-94..DEV-98` en `Done`).
- Siguiente objetivo: abrir y ejecutar Wave 20 con foco en login-first manager y paridad de sesion runtime.

## P0 (inmediato)

- [ ] Crear y registrar Wave 20 en Jira:
  - epic devops
  - architect contract
  - backend auth/me endpoint
  - mobile login-first wiring
  - qa regression
- [ ] Mover architect/backend a `In Progress` para activar board visible.
- [ ] Ejecutar primer ciclo Wave 20 (`architect`) y abrir PR draft enlazada a Jira.

## P1

- [ ] Completar ciclo backend -> mobile -> qa de Wave 20.
- [ ] Validar flujo login-first en emulador Android (manager app).
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
