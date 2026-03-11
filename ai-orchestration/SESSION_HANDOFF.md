# Session Handoff (2026-03-11)

## Current State

- Repository: `D:\still\kconecta-app`
- Branch local actual: `main` (sincronizada con `origin/main` antes de este set de cambios).
- Proteccion de rama `main`: activa (sin push directo, requiere PR).
- Politica runtime: Docker-only para backend (sin XAMPP).
- Wave activa en Jira: `Wave 22 - Manager portfolio filter + pagination parity`.
- Jira open (`statusCategory != Done`): `5`
  - `DEV-109` epic/devops (`In Progress`)
  - `DEV-110` architect (`In Progress`)
  - `DEV-111` backend (`In Progress`)
  - `DEV-112` mobile (`In Progress`)
  - `DEV-113` qa (`To Do`)
- PRs abiertas actuales:
  - `#95` `DEV-110` (architect, draft)
  - `#96` `DEV-111` (backend, draft)
  - `#97` `DEV-109` (devops, draft)

## Aider Hardening Applied (Root Fix)

Se implemento hardening estructural en orquestacion:

1. Prompts mas cortos por tarea:
   - Compactacion fuerte de prompt de ejecucion.
   - Limites por seccion (`file_scope`, `acceptance`, `validation`) y por longitud.
2. Particion automatica de cambios:
   - Split por lotes segun `files_scope` agrupado por ruta.
   - Batch mode mantiene guardrails de scope.
3. Timeout/retries adaptativos por agente:
   - Politicas por defecto para `architect/backend/mobile/qa/devops`.
   - Retries por modelo + timeout incremental por retry.
   - Overrides por entorno (`AIDER_AGENT_<AGENT>_*`).
4. Observabilidad:
   - `preflight` ahora reporta `checks.aider_agent_policies`.
   - `run-task` en apply reporta `aider_policy` efectiva.

Archivos clave tocados:
- `ai-orchestration/ai_orchestration/services/aider_service.py`
- `ai-orchestration/ai_orchestration/services/executor_service.py`
- `ai-orchestration/ai_orchestration/orchestrator_app.py`
- `ai-orchestration/README.md`

## Validation Snapshot

- `py -m compileall ai-orchestration/ai_orchestration` -> OK
- `py ai-orchestration/orchestrator.py preflight` -> OK
- `AI_EXECUTOR=aider` confirmado en preflight -> OK
- `run-task` real Wave 22 `MOB-019` con Aider -> timeout tras presupuesto de politica mobile (`1320s`).

Conclusion:
- La base quedo mejor instrumentada y mas estable.
- Sigue existiendo bloqueo en tareas mobile largas (a resolver con tuning adicional o particion de task).

## Workflow Guardrails (Do Not Break)

- No hacer `git push origin main`.
- Flujo obligatorio: `branch de agente -> PR draft -> review -> merge`.
- Regla de proteccion ya validada en vivo (`GH006` rechazo de push directo a `main`).

## Known Blockers

1. Aider en tareas largas de mobile (`MOB-019`) aun puede agotar presupuesto.
2. Google AG presenta intermitencia por cuota (`429`) y cae a Ollama fallback.
3. Test Laravel end-to-end depende de runtime Docker app/php; no usar host PHP/XAMPP.

## Resume Commands (post-restart)

```powershell
cd D:\still\kconecta-app
$env:GIT_CONFIG_COUNT=1
$env:GIT_CONFIG_KEY_0='safe.directory'
$env:GIT_CONFIG_VALUE_0='*'
$env:AI_EXECUTOR='aider'
$env:AIDER_EDIT_FORMAT='diff'
py ai-orchestration/orchestrator.py preflight
gh pr list --state open --limit 20
py ai-orchestration/orchestrator.py jira-list --status open --max-results 20
```

Opcional tuning inmediato para desbloquear mobile:

```powershell
$env:AIDER_AGENT_MOBILE_TOTAL_TIMEOUT_SECONDS='2100'
$env:AIDER_AGENT_MOBILE_RETRIES='3'
$env:AIDER_AGENT_MOBILE_BATCH_SIZE='1'
```

## Next Natural Actions

1. Ejecutar `BE-020` real con `AI_EXECUTOR=aider` para avanzar Wave 22 backend.
2. Reintentar `MOB-019` con tuning mobile o dividir task en subtareas.
3. Abrir `DEV-113` (QA) cuando backend/mobile queden listos.
4. Continuar flujo PR/Jira sin saltar guardrails de rama protegida.
