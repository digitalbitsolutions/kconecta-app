# TODO Prioritario - Wave 22

Fecha: 2026-03-11  
Repo objetivo: `D:\still\kconecta-app`

## Estado actual

- Wave 22 activa en Jira.
- PRs abiertos:
  - `#95` DEV-110 (architect) DRAFT
  - `#96` DEV-111 (backend) READY
  - `#97` DEV-109 (devops) DRAFT
  - `#98` DEV-112 (mobile) READY
  - `#99` DEV-113 (qa) DRAFT

## P0 (inmediato)

- [ ] Revisar y mergear `#96` (backend) -> mover `DEV-111` a `Done`.
- [ ] Revisar y mergear `#98` (mobile) -> mover `DEV-112` a `Done`.
- [ ] Resolver Docker engine pipe issue (`dockerDesktopLinuxEngine` HTTP 500) para habilitar validaciones QA en contenedor.
- [ ] Ejecutar validaciones QA Wave 22 y marcar `#99` ready.
- [ ] Revisar/mergear `#95` y `#97`, luego cerrar epic Wave 22.

## P1 (siguiente ola)

- [ ] Abrir Wave 23 (epic + architect/backend/mobile/qa).
- [ ] Mantener `TO DO/In Progress` visibles en board desde inicio del sprint.

## Bloqueos y mitigaciones

- [ ] Aider en tasks largos con `diff` tiende a timeout.
  - Mitigacion aplicada: particionar task + `AIDER_EDIT_FORMAT=whole` + `map-tokens=0`.
- [ ] Docker CLI responde HTTP 500 contra pipe local.
  - Mitigacion: estabilizar Docker Desktop/contexto antes de ejecutar php lint/tests.

## Restricciones activas

- [x] NO usar XAMPP.
- [x] Solo Docker para backend runtime/tests.
- [x] No comandos destructivos de Git.
- [x] No push directo a `main` (solo PR flow).

## Comandos de reanudacion

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
```
