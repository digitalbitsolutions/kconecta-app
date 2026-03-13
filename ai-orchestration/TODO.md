# TODO Prioritario - Wave 24

Fecha: 2026-03-12  
Repo objetivo: `D:\still\kconecta-app`

## Estado actual

- Wave 23: cerrada y mergeada.
- Wave 24: parcialmente cerrada.
- PRs abiertos: ninguno.
- Últimos merges relevantes:
  - `#104` architect (`DEV-119`)
  - `#105` backend (`DEV-121`)
  - `#107` devops (fallback `aider -> openclaw`)
  - `#108` fix CI (tests duplicados)

## P0 (inmediato)

- [ ] Ejecutar `DEV-122` (mobile / `MOB-021`) con `AI_EXECUTOR=aider`.
- [ ] Abrir PR draft de mobile y actualizar Jira (`In Progress` -> `In Review`).
- [ ] Ejecutar ticket QA de Wave 24 y abrir PR QA.
- [ ] Mergear mobile + QA y cerrar epic Wave 24 en Jira.

## P1 (siguiente ola)

- [ ] Abrir Wave 25 (epic + architect/backend/mobile/qa).
- [ ] Mantener visible `To Do` + `In Progress` en Board al iniciar sprint.
- [ ] Vincular cada PR al ticket Jira (`DEV-xxx`) para trazabilidad en Code panel.

## Bloqueos y mitigaciones

- [ ] OpenClaw fallback sigue en observación.
  - Estado: fallback se activa, pero esta variante puede intentar editar fuera de `files_scope`.
  - Mitigación: mantener `AI_EXECUTOR=aider` por defecto en ejecución real.
- [ ] Aider puede tardar en tareas largas.
  - Mitigación ya aplicada: prompt corto, partición por scope, timeouts/retries por agente, timeout-recovery.

## Restricciones activas

- [x] NO usar XAMPP.
- [x] Solo Docker para backend runtime/tests.
- [x] No usar `php artisan test` directo en host (usar `backend-test-docker`).
- [x] No comandos destructivos de Git.
- [x] No push directo a `main` (solo PR flow).

## Comandos de reanudación

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
