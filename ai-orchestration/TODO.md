# TODO prioritario - Reanudacion de orquestacion

Fecha: 2026-03-07
Repo objetivo: D:\still\kconecta-app
Estado: Pendiente de retomar (prioridad alta)

## 1) Bloqueante principal (P0)
- [ ] Resolver ejecutor OpenClaw con soporte `openclaw run`.
- [ ] Si la version actual no soporta `run`, mantener `AiderExecutor` como fallback operativo.
- [ ] Revalidar selector con `AI_EXECUTOR=auto` y confirmar `selected_executor` en preflight.

## 2) Validacion tecnica inmediata (P0)
- [ ] Ejecutar: `py ai-orchestration/orchestrator.py preflight`
- [ ] Confirmar campos: `openclaw_available`, `aider_available`, `selected_executor`, `google_ag_available`, `ollama_available`.
- [ ] Verificar que no haya fallback inesperado cuando OpenClaw este bien instalado.

## 3) Continuidad de desarrollo (P1)
- [ ] Retomar Wave 11 (ARCH-007, MOB-008, QA-010) en modo apply controlado.
- [ ] Ejecutar primero Architect (ARCH-007) y luego Mobile/QA.
- [ ] Mantener cambios dentro de `files_scope` y commits semanticos.

## 4) Jira y trazabilidad (P1)
- [ ] Revisar board/filtros/sprint activo para visualizar To Do / In Progress / Done.
- [ ] Mantener comentarios automaticos por ejecucion en tickets DEV-55, DEV-56, DEV-57.
- [ ] Ajustar estados para que el board refleje avance real.

## 5) Comandos de arranque rapido al volver
```powershell
cd D:\still\kconecta-app
py ai-orchestration/orchestrator.py preflight
py ai-orchestration/orchestrator.py run-task --agent architect --task-file ai-orchestration/tasks/architect_wave11_ui_information_architecture_task.json --dry-run
```

## Nota operativa
- Docker Desktop puede permanecer encendido.
- Backend CRM origen en Docker: instancia `kconecta` (contexto ya confirmado).
