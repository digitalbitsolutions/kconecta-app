# Mobile CRM Integration Audit (2026-03-19)

## Scope

- Mobile repo audited: `D:\still\kconecta-app`
- CRM backend audited: `D:\still\kconecta.com\web`
- Local runtime checked on: `http://127.0.0.1:8010` (Docker container `kconecta`)
- Public production check executed on: `https://kconecta.com`

This audit compares what the React Native apps expect against what the CRM API exposes in local Docker vs public production URL.

## Local CRM API (observed)

Smoke checks against `http://127.0.0.1:8010/api`:

- `POST /auth/login` -> `200`
- `GET /auth/me` -> `200` (Bearer required)
- `GET /properties` -> `200`
- `GET /properties/summary` -> `200`
- `GET /providers` -> `200`
- `GET /providers/{id}` -> `200`
- `GET /providers/{id}/availability` -> `200`

Legacy endpoints also available:

- `GET /services` -> `200`
- `GET /properties_for_map` -> `200`
- `GET /services_for_map` -> `200`

## Public Production API (observed)

Check against `https://kconecta.com/api/auth/login`:

- `POST /auth/login` -> `404 Not Found`

Implication: the mobile auth contract verified in local Docker is not currently exposed at that public URL.

## Mobile Contract vs CRM Contract

| Mobile expectation | Local Docker CRM | Public production URL |
| --- | --- | --- |
| `POST /api/auth/login` | Available (`200`) | Missing (`404`) |
| `POST /api/auth/refresh` | Available in local codebase contract | Not confirmed in public URL |
| `GET /api/auth/me` | Available (`200`) | Not confirmed in public URL |
| `GET /api/providers` | Available (`200`) | Not confirmed in public URL |
| `GET /api/properties` | Available (`200`) | Not re-checked in this pass |

## Local smoke identities validated

- `manager@kconecta.local` -> role `manager` (success)
- `info@sttil.com` -> role `admin` (success)

Credentials are intentionally omitted from this document.

## Conclusion

- For local development, the app can continue against `http://10.0.2.2:8010/api` (emulator).
- For release readiness, backend deployment parity is still pending because `kconecta.com` does not expose the same mobile auth route set yet.

## Recommended Next Step

1. Keep mobile development on local Docker contract.
2. Define/confirm the real deployed API base URL that includes the mobile auth/provider contract.
3. Re-run the same smoke matrix on that deployed URL before release gates.
