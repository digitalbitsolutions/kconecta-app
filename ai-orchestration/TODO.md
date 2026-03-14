# TODO Prioritario - Wave 32

Fecha: 2026-03-14  
Repo objetivo: `D:\still\kconecta-app`

## Estado actual

- Wave 31: cerrada y mergeada.
- PRs Wave 31: fusionados (`#135`-`#139`).
- Jira Wave 31: cerrado (`DEV-154`..`DEV-158`).
- Siguiente foco: Wave 32 - Assignment status management.

## P0 (inmediato)

- [ ] Crear epic y 4 tickets de Wave 32 en Jira desde task files.
- [ ] Pasar epic y architect a `In Progress`.
- [ ] Ejecutar `ARCH-026` con apoyo de `Google AG` para contrato corto y preciso.
- [ ] Ejecutar backend/mobile/qa de Wave 32 manteniendo prompts cortos por scope.

## P1 (después de abrir Wave 32)

- [ ] Mantener visible `To Do` + `In Progress` en Board con sprint activo.
- [ ] Enlazar cada PR al ticket Jira correspondiente.
- [ ] Cerrar la wave completa sin acumular PRs viejos.

## Bloqueos y mitigaciones

- [ ] `aider` sigue siendo sensible a tareas largas.
  - Mitigación: partir tareas por `files_scope`, usar `Google AG` para descomposición previa y hacer recovery manual si es necesario.
- [ ] `openclaw` puede dejar artefactos locales no trackeados.
  - Mitigación: limpiar worktree antes de sync/merge si reaparecen.

## Restricciones activas

- [x] NO usar XAMPP.
- [x] Solo Docker para backend runtime/tests.
- [x] No usar `php artisan test` directo en host.
- [x] No comandos destructivos de Git.
- [x] No push directo a `main` (solo PR flow).
- [x] `Google AG` solo como planner/reviewer, no editor directo.

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
