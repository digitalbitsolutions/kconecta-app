# TODO Prioritario - Apertura Wave 28

Fecha: 2026-03-13  
Repo objetivo: `D:\still\kconecta-app`

## Estado actual

- Wave 27: cerrada y mergeada (`DEV-134..138` en Done).
- Jira open issues: `0`.
- PRs abiertos solo de contexto/devops:
  - `#120`
  - `#121`
  - `#122`

## P0 (inmediato)

- [ ] Definir Wave 28 (epic + architect/backend/mobile/qa).
- [ ] Usar Google AG para descomponer la siguiente brecha de parity del manager app antes de ejecutar.
- [ ] Crear task files de la nueva wave y abrir tickets Jira.
- [ ] Iniciar sprint para que el board vuelva a mostrar `To Do` / `In Progress`.

## P1 (ejecución siguiente)

- [ ] Ejecutar architect de Wave 28.
- [ ] Abrir PR draft del architect ticket.
- [ ] Ejecutar backend -> mobile -> qa con PR draft por cada ticket.

## Bloqueos y mitigaciones

- [ ] Aider puede seguir haciendo timeout en tareas largas.
  - Mitigación vigente:
    - prompts más cortos,
    - partición automática por scope,
    - retries/timeout adaptativo,
    - Google AG para planning/review/contract reasoning,
    - recuperación manual por worktree si vuelve a colgarse.
- [ ] OpenClaw fallback sigue bajo observación.
  - Mitigación:
    - usarlo solo como fallback controlado,
    - limpiar artefactos locales del worktree afectado si aparecen.

## Restricciones activas

- [x] NO usar XAMPP.
- [x] Solo Docker para runtime/tests de backend.
- [x] No usar `php artisan test` directo en host.
- [x] Usar `py ai-orchestration/orchestrator.py backend-test-docker`.
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
