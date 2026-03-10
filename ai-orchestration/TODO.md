# TODO prioritario - Reanudacion de orquestacion

Fecha: 2026-03-09
Repo objetivo: `D:\still\kconecta-app`
Estado: app manager arrancable en emulador; Wave 16 abierta para cerrar brecha hacia 1:1 con CRM.

## Estado actual verificado

- Manager app inicia y renderiza Dashboard en Android Emulator con Expo Go.
- Providers app tambien tiene scaffold funcional.
- Jira + GitHub vinculados (repositorio `digitalbitsolutions/kconecta-app` conectado en Code).
- Wave 16 creada y publicada en Jira:
  - `DEV-79` epic (To Do)
  - `DEV-80` architect (In Progress)
  - `DEV-81` backend (To Do)
  - `DEV-82` mobile (To Do)
  - `DEV-83` qa (To Do)

## Decisiones operativas vigentes

- Ejecutar con `AI_EXECUTOR=aider` (OpenClaw en observacion).
- Mantener merge gate humano (`approve-merge` + `merge-pr`).
- No usar comandos destructivos.
- Entorno backend/testing: Docker Desktop (sin XAMPP).
- Politica tecnica activa: runner bloquea `xampp` y `php` host; usar Docker (`backend-test-docker` o MCP docker).

## Pendientes P0 (siguiente sesion)

- [ ] Ejecutar `DEV-80` (architect) y abrir PR draft con issue key.
- [ ] Ejecutar `DEV-81` (backend) y abrir PR draft con issue key.
- [ ] Ejecutar `DEV-82` (mobile) y abrir PR draft con issue key.
- [ ] Ejecutar `DEV-83` (qa) y abrir PR draft con issue key.

## Pendientes P1

- [ ] Cobertura QA de regresion auth + disponibilidad.
- [ ] Hardening de errores de red y sesion expirada en ambas apps.
- [ ] Checklist de release interno (build profile, envs, smoke en emulador).

## Comandos estables (Expo en emulador)

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

## Prompt recomendado para retomar con Codex

```text
Continuemos en kconecta-app desde el ultimo snapshot.
1) Mantén AI_EXECUTOR=aider.
2) Revisa Jira abierto de la wave activa y PRs abiertos.
3) Ejecuta el ciclo backend -> mobile -> qa con PRs y actualización Jira.
4) No uses comandos destructivos.
5) Reporta avances y bloqueos brevemente en cada paso.
```
