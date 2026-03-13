# TODO Prioritario - Cierre Wave 26 / Apertura Wave 27

Fecha: 2026-03-13  
Repo objetivo: `D:\still\kconecta-app`

## Estado actual

- Wave 26: funcionalmente cerrada en Jira (`DEV-129..133` en Done).
- PRs abiertos (draft):
  - `#118` mobile (`DEV-132`)
  - `#119` qa (`DEV-133`)

## P0 (inmediato)

- [ ] Pasar `#118` y `#119` a ready for review.
- [ ] Aprobar/mergear `#118`.
- [ ] Aprobar/mergear `#119`.
- [ ] Verificar board Jira post-merge (sin items Wave 26 en `In Progress`).

## P1 (siguiente ola)

- [ ] Abrir Wave 27 (epic + architect/backend/mobile/qa).
- [ ] Pasar ticket architect de Wave 27 a `In Progress`.
- [ ] Ejecutar flujo architect -> backend -> mobile -> qa con PR draft por cada ticket.

## Bloqueos y mitigaciones

- [ ] Aider timeout en tareas largas.
  - Mitigación vigente:
    - prompts más cortos,
    - partición automática por scope,
    - retries/timeout adaptativo,
    - recuperación manual por worktree si vuelve a colgarse.
- [ ] OpenClaw fallback puede dejar archivos basura no trackeados.
  - Mitigación:
    - limpiar worktree afectado con `git clean -fd` antes de continuar.

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
```
