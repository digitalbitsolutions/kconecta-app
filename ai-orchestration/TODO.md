# TODO Prioritario - Cierre Wave 29 / Apertura Wave 30

Fecha: 2026-03-13  
Repo objetivo: `D:\still\kconecta-app`

## Estado actual

- Wave 29: ejecutada end-to-end y lista para merge.
- PRs abiertos de Wave 29:
  - `#131`
  - `#132`
  - `#133`
  - `#134`
- PRs abiertos de contexto/devops:
  - `#120`
  - `#121`
  - `#122`
- Wave 30: task files y plan ya definidos en `agent/devops-context`.

## P0 (inmediato)

- [ ] Mergear Wave 29:
  - `#131` architect
  - `#132` backend
  - `#133` mobile
  - `#134` qa
- [ ] Verificar Jira con `DEV-144..148` cerrado de forma consistente en board/summary.
- [ ] Abrir Wave 30 en Jira desde los task files:
  - `EPIC-W30`
  - `ARCH-024`
  - `BE-026`
  - `MOB-027`
  - `QA-029`
- [ ] Poner `ARCH-024` en `In Progress`.

## P1 (ejecución siguiente)

- [ ] Ejecutar architect de Wave 30 con apoyo de Google AG para contrato y state map.
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
