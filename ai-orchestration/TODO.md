# TODO prioritario - Reanudacion de orquestacion

Fecha: 2026-03-09
Repo objetivo: `D:\still\kconecta-app`
Estado: app manager arrancable en emulador; continuar cierre funcional hacia 1:1 con CRM.

## Estado actual verificado

- Manager app inicia y renderiza Dashboard en Android Emulator con Expo Go.
- Providers app tambien tiene scaffold funcional.
- Jira + GitHub vinculados (repositorio `digitalbitsolutions/kconecta-app` conectado en Code).
- Persisten tareas de cierre por wave para backend/mobile/qa (ver Jira antes de continuar).

## Decisiones operativas vigentes

- Ejecutar con `AI_EXECUTOR=aider` (OpenClaw en observacion).
- Mantener merge gate humano (`approve-merge` + `merge-pr`).
- No usar comandos destructivos.
- Entorno backend/testing: Docker Desktop (sin XAMPP).

## Pendientes P0 (siguiente sesion)

- [ ] Confirmar en Jira el conjunto exacto de tickets abiertos de la wave activa.
- [ ] Cerrar PRs/merges pendientes con issue key en titulo/descripción para trazabilidad en Jira Code.
- [ ] Completar flujo auth real contra backend (endpoint login/sesion estable) en manager y providers.
- [ ] Sustituir datos mock de dashboard por data real de API en manager.

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
