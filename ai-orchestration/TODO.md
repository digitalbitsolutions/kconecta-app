# TODO prioritario - Wave 18

Fecha: 2026-03-10
Repo objetivo: `D:\still\kconecta-app`

## Estado

- Wave activa: `Wave 18 - Manager auth hardening and property form parity`.
- Jira abierto: `DEV-89`, `DEV-90`, `DEV-91`, `DEV-92`, `DEV-93` (todos `In Progress`).
- PRs draft abiertos:
  - `#76` architect
  - `#77` backend
  - `#78` mobile
  - `#79` qa (CONFLICTING)

## P0 (inmediato)

- [ ] Resolver conflicto de `#79` (`agent/qa` vs `main`).
- [ ] Revisar y aprobar `#76`.
- [ ] Ejecutar `approve-merge` + `merge-pr` para `#76`.
- [ ] Revisar y aprobar `#77`.
- [ ] Ejecutar `approve-merge` + `merge-pr` para `#77`.
- [ ] Revisar y aprobar `#78`.
- [ ] Ejecutar `approve-merge` + `merge-pr` para `#78`.
- [ ] Revalidar `#79` tras rebase/merge de `main`, luego aprobar y merge.
- [ ] Transicionar Jira a `Done` (`DEV-90/91/93/92`) y cerrar epic `DEV-89`.

## P1

- [ ] Smoke test manager en emulador con `main` mergeado:
  - login manager
  - listado de propiedades
  - crear propiedad
  - editar propiedad
  - validar refresco list/detail
- [ ] Definir Wave 19 con foco en paridad de acciones avanzadas del CRM manager.

## Restricciones activas

- [x] No usar XAMPP.
- [x] Backend/testing por Docker.
- [x] No usar comandos destructivos.
- [x] Mantener `AI_EXECUTOR=aider`.

## Comandos base

```powershell
cd D:\still\kconecta-app
$env:AI_EXECUTOR='aider'
$env:AIDER_EDIT_FORMAT='diff'
$env:AIDER_EXEC_TIMEOUT_SECONDS='600'
py ai-orchestration/orchestrator.py preflight
gh pr list --state open --limit 20
py ai-orchestration/orchestrator.py jira-list --max-results 20
```