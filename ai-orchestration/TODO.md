# TODO Prioritario - Mobile CRM Integration (Wave 28)

Fecha: 2026-03-19  
Repo objetivo: `D:\still\kconecta-app`

## Estado actual

- Backend local CRM en Docker operativo (`kconecta` -> `http://127.0.0.1:8010`).
- Smoke de contrato móvil local completado para manager y admin.
- Flujo en producción pública (`kconecta.com`) aún no expone login móvil (`/api/auth/login` devuelve 404).

## P0 (inmediato)

- [ ] Cerrar ajustes de UX móvil tras auth real (manager/providers).
- [ ] Completar navegación end-to-end manager con datos reales de DB local.
- [ ] Definir checklist de paridad `local vs production` para endpoints móviles.
- [ ] Preparar PR con cambios de app y contexto (sin artefactos temporales).

## P1 (siguiente)

- [ ] Alinear despliegue de endpoints móviles en entorno productivo/staging del CRM.
- [ ] Ejecutar regresión móvil en emulador y dispositivo físico contra backend desplegado.
- [ ] Congelar contrato de release (`auth/properties/providers`) y versionado.

## Bloqueos y mitigaciones

- [ ] Producción pública sin `POST /api/auth/login`.
  - Mitigación: mantener validación local y acordar endpoint base real para release.
- [ ] Ruido de artefactos locales (`.tmp-*`, `.env`) en worktree.
  - Mitigación: excluir de commits y limpiar antes de PR.

## Restricciones activas

- [x] NO usar XAMPP.
- [x] Solo Docker para backend runtime/tests.
- [x] No push directo a `main` (solo PR flow).
- [x] Evitar comandos destructivos de Git.

## Comandos de reanudación

```powershell
cd D:\still\kconecta-app
$env:GIT_CONFIG_COUNT=1
$env:GIT_CONFIG_KEY_0='safe.directory'
$env:GIT_CONFIG_VALUE_0='*'
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```
