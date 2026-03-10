# Session Handoff (2026-03-09)

## Current State

- Repository: `D:\still\kconecta-app`
- Executor policy: `AI_EXECUTOR=aider` (OpenClaw en observacion)
- Mobile runtime: manager app validada en emulador Android con Expo Go
- Backend test policy: Docker-only (sin XAMPP)
- Jira/GitHub: enlace de repositorio ya completado en Atlassian (backfill finalizado)
- Wave activa: `Wave 16 - Manager parity foundation`
- Jira abierto:
  - `DEV-79` (epic/devops) To Do
  - `DEV-80` (architect/ARCH-012) In Progress
  - `DEV-81` (backend/BE-014) To Do
  - `DEV-82` (mobile/MOB-013) To Do
  - `DEV-83` (qa/QA-015) To Do

## Important Runtime Notes

- Politica de ejecucion reforzada: el runner de orquestacion bloquea comandos con `xampp` y `php` local.
  - Ruta permitida: `py ai-orchestration/orchestrator.py backend-test-docker`
  - MCP permitido: `docker.run_backend_tests`

- El error recurrente de Expo (`Something went wrong` / `Failed to download remote update`) fue por flujo de arranque inestable (`localhost` IPv6 y sesiones previas de Expo Go).
- Flujo estable recomendado para emulador:

```powershell
cd D:\still\kconecta-app\apps\manager
npx expo start --go --lan --port 8088 --clear
```

En otra terminal:

```powershell
adb -s emulator-5554 shell pm clear host.exp.exponent
adb -s emulator-5554 reverse --remove-all
adb -s emulator-5554 reverse tcp:8088 tcp:8088
adb -s emulator-5554 shell am start -a android.intent.action.VIEW -d exp://127.0.0.1:8088
```

- Si Metro muestra IP LAN (por ejemplo `exp://192.168.x.x:8088`), abrir con esa URL tambien es valido:

```powershell
adb -s emulator-5554 shell am start -a android.intent.action.VIEW -d exp://192.168.1.144:8088
```

## Delivery Snapshot

- Manager/Providers scaffold RN+TS creado y arrancable con Expo.
- Login UI y session plumbing implementados en ambas apps.
- Theming base y branding (`logo-clean`) integrados.
- Archivos de tareas Wave 14 y Wave 15 presentes en `ai-orchestration/tasks/`.
- Contexto operativo actualizado para reanudar sin friccion.

## Resume Commands

```powershell
cd D:\still\kconecta-app
$env:GIT_CONFIG_COUNT=1
$env:GIT_CONFIG_KEY_0='safe.directory'
$env:GIT_CONFIG_VALUE_0='*'
$env:AI_EXECUTOR='aider'
$env:AIDER_EDIT_FORMAT='diff'
$env:AIDER_EXEC_TIMEOUT_SECONDS='600'
py ai-orchestration/orchestrator.py preflight
py ai-orchestration/orchestrator.py jira-list --status open --max-results 20
gh pr list --state open --limit 20
```

## Resume Prompt (copy/paste)

```text
Continuemos en kconecta-app desde el estado actual.
1) Manten AI_EXECUTOR=aider.
2) Revisa Jira abierto en Wave activa y PRs abiertos.
3) Ejecuta el siguiente ciclo architect -> backend -> mobile -> qa con PRs y actualizacion Jira.
4) No uses comandos destructivos.
5) Reporta avances y bloqueos brevemente.
```
