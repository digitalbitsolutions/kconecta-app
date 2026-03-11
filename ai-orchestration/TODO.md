# TODO prioritario - Wave 22

Fecha: 2026-03-11  
Repo objetivo: `D:\still\kconecta-app`

## Estado actual

- Wave 22 abierta y activa en Jira.
- Issues abiertas:
  - `DEV-109` epic (`In Progress`)
  - `DEV-110` architect (`In Progress`)
  - `DEV-111` backend (`In Progress`)
  - `DEV-112` mobile (`In Progress`)
  - `DEV-113` qa (`To Do`)
- PRs draft abiertas:
  - `#95` DEV-110 architect
  - `#96` DEV-111 backend
  - `#97` DEV-109 devops

## P0 (inmediato)

- [ ] Ejecutar `BE-020` en apply mode con `AI_EXECUTOR=aider` y cerrar backend de Wave 22.
- [ ] Reintentar `MOB-019` con politicas Aider por agente (timeout/retries/batch tuning).
- [ ] Abrir ciclo QA (`DEV-113`) tras backend+mobile estables.
- [ ] Mantener Jira actualizado en cada transicion (`To Do` -> `In Progress` -> `In Review` -> `Done`).

## P1 (estabilizacion de ejecucion)

- [ ] Confirmar mejora real de Aider en apply mode con evidencia de logs/transcripts.
- [ ] Si persiste timeout en mobile:
  - dividir `MOB-019` en subtareas mas pequenas,
  - y/o subir `AIDER_AGENT_MOBILE_TOTAL_TIMEOUT_SECONDS`.
- [ ] Mantener fallback manual en worktree solo como contingencia controlada.

## Bloqueos y mitigaciones

- [ ] Timeout en Aider para `MOB-019` con politica actual mobile (`1320s`).
  - Mitigacion recomendada:
    - `AIDER_AGENT_MOBILE_TOTAL_TIMEOUT_SECONDS=2100`
    - `AIDER_AGENT_MOBILE_RETRIES=3`
    - `AIDER_AGENT_MOBILE_BATCH_SIZE=1`
- [ ] Google AG puede devolver `429` por cuota y caer a fallback Ollama.
  - Mitigacion: mantener prompts cortos y continuidad local.
- [ ] Backend tests solo por Docker app/php (nunca por XAMPP).

## Restricciones activas

- [x] No usar XAMPP (solo Docker Desktop).
- [x] No usar comandos destructivos de Git.
- [x] Flujo obligatorio por PR (main protegida).
- [x] Mantener trazabilidad Jira + PR + logs.

## Guardrail GitHub (permanente)

- [x] `main` protegida contra push directo.
- [x] Merge via PR + aprobacion humana.
- [ ] Verificacion rapida al iniciar sesion:
  - `gh api repos/digitalbitsolutions/kconecta-app/branches/main/protection --jq \"{enforce_admins: .enforce_admins.enabled, require_pr_reviews: (.required_pull_request_reviews.required_approving_review_count), required_conversation_resolution: .required_conversation_resolution.enabled}\"`

## Comandos de reanudacion

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
