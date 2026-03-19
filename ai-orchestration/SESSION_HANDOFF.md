# Session Handoff (2026-03-19)

## Current State

- Repository: `D:\still\kconecta-app`
- Branch: `agent/devops-wave27` at `00f654b`
- Main protection: enforced (`PR required`, direct push blocked)
- Backend runtime policy: Docker-only (`NO XAMPP`)
- Local backend validated at: `http://127.0.0.1:8010` (container `kconecta`)

## Mobile + CRM Integration Status (Today)

- CRM mobile endpoints are available in local Docker backend (`D:\still\kconecta.com\web`).
- Contract smoke validated against local API base (`/api`):
  - `POST /auth/login` -> OK (manager/admin local users)
  - `GET /auth/me` -> OK
  - `GET /properties` -> OK
  - `GET /properties/summary` -> OK (`source=database`)
  - `GET /providers` -> OK
  - `GET /providers/{id}` and `/providers/{id}/availability` -> OK
- Production host `https://kconecta.com/api/auth/login` currently returns `404` (mobile auth contract not exposed there yet).

## Local Accounts Verified (Dev)

- `manager@kconecta.local` -> role `manager` (smoke OK)
- `info@sttil.com` -> role `admin` (smoke OK)

Notes:
- Passwords are intentionally omitted from handoff docs.
- Credentials are available in team secure channel / local operator context.

## Working Tree Snapshot

Tracked modified files:
- `apps/manager/src/screens/auth/LoginScreen.tsx`
- `apps/providers/src/api/providerApi.ts`
- `apps/providers/src/screens/AvailabilityShellScreen.tsx`
- `apps/providers/src/screens/auth/LoginScreen.tsx`
- `package-lock.json`

Untracked notable files:
- `docs/architecture/mobile-crm-integration-audit-2026-03-19.md`
- local temp screenshots/logs (`.tmp-*`) and local `.env`

## Guardrails (Do Not Break)

- Never push directly to `main`.
- Always use feature/agent branch -> PR -> review -> merge.
- Keep `NO XAMPP` policy.
- Use Docker for backend checks/tests.
- Never run `php artisan test` directly on host. Use `py ai-orchestration/orchestrator.py backend-test-docker`.
- Avoid destructive Git commands.

## Resume Commands

```powershell
cd D:\still\kconecta-app
$env:GIT_CONFIG_COUNT=1
$env:GIT_CONFIG_KEY_0='safe.directory'
$env:GIT_CONFIG_VALUE_0='*'
$env:AI_EXECUTOR='aider'
py ai-orchestration/orchestrator.py preflight
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

## Next Natural Actions

1. Continue app work in `D:\still\kconecta-app` against local CRM API (`http://10.0.2.2:8010/api` on emulator).
2. Keep parity checklist local vs production for mobile endpoints before release gate.
3. Commit only source/docs changes; exclude `.env` and `.tmp-*` artifacts from commits.
4. Open PR from current working branch once clean commit set is ready.
