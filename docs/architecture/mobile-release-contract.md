# Mobile Release Contract

## Objective

Define the minimum environment and auth contract required for native app release candidates to consume CRM APIs in local Docker and production-compatible environments.

## Required Mobile Environment Variables

- `EXPO_PUBLIC_API_URL`
  - Base API URL used by mobile clients.
  - Local Android emulator default: `http://10.0.2.2:8000/api`
- `EXPO_PUBLIC_MOBILE_API_TOKEN`
  - Bearer token sent by mobile apps for API access.
  - Local default for development: `kconecta-dev-token`
- `EXPO_PUBLIC_APP_STAGE`
  - `local`, `staging`, `production`
- `EXPO_PUBLIC_SHOW_ENV_DIAGNOSTICS`
  - Optional debug switch (`true`/`false`) to display runtime diagnostics in non-production builds.

## Backend Environment Variable

- `KC_MOBILE_API_TOKEN`
  - Server-side expected token for mobile bearer auth.
  - Must match `EXPO_PUBLIC_MOBILE_API_TOKEN` in each environment.

## Backend Data Source Variables (v0.2.0)

- `KC_PROVIDER_DATA_SOURCE`, `KC_PROPERTY_DATA_SOURCE`
  - `auto`: DB-first with in-memory fallback.
  - `database`: strict DB read.
  - `seed`: force in-memory dataset.
- `KC_PROVIDER_TABLE`, `KC_PROPERTY_TABLE`
  - Table names used by backend read services.
  - Allow compatibility with CRM schema naming without code changes.

## API Observability Contract

- Provider/property list endpoints include `meta.source` with:
  - `database` when payload comes from DB table reads.
  - `in_memory` when fallback dataset is used.

## Auth/Session Lifecycle Contract (Wave 10)

### Session States

- `unauthenticated`: no active access token.
- `authenticated`: access token is valid and scope-checked.
- `refreshing`: client is exchanging refresh token for a new access token.
- `expired`: access token expired; one refresh attempt is allowed.
- `terminated`: logout/revocation completed and local credentials wiped.

### Login Contract

- Endpoint: `POST /api/auth/login`
- Expected response shape:
  - `access_token`
  - `refresh_token`
  - `expires_at` (ISO-8601 UTC timestamp)
  - `scope` (role-aware permission list)
- Client responsibilities:
  - Persist tokens in secure storage.
  - Keep token metadata in memory only while app is running.

### Refresh Contract

- Endpoint: `POST /api/auth/refresh`
- Trigger: first `401` with code `TOKEN_EXPIRED`.
- Behavior:
  - Rotate access token.
  - Optionally rotate refresh token.
  - Retry the failed request once after successful refresh.
- If refresh fails (`TOKEN_INVALID` or `TOKEN_REVOKED`), client moves to `unauthenticated`.

### Logout Contract

- Endpoint: `POST /api/auth/logout`
- Backend responsibilities:
  - Revoke current token chain.
  - Return idempotent success on repeated logout.
- Client responsibilities:
  - Clear secure storage tokens.
  - Clear in-memory session cache.
  - Redirect to auth entry screen.

### Role and Scope Rules

- `manager`: property CRUD, provider read, manager dashboards.
- `provider`: own profile/services/availability and assigned jobs.
- `admin`: full cross-domain access.
- Insufficient scope must return `403` (never `200` with filtered side effects).

### Bootstrap Compatibility Mode

- Until all auth endpoints are deployed, native apps may use static bearer auth:
  - `Authorization: Bearer <KC_MOBILE_API_TOKEN>`
- Static token mode remains valid for bootstrap/read endpoints only.
- Final target is refreshable role-scoped session tokens.

## Wave 12 Cross-App Auth Boundary Contract

### Deep Link Payload Contract

- Required payload fields:
  - `origin_app`: `manager-app` | `provider-app`
  - `target_screen`: route id in destination app
  - `handoff_token`: short-lived opaque token
  - Domain ids as needed (`providerId`, `propertyId`)
- Rejection behavior:
  - Missing required fields -> local reject and route `Unauthorized`.
  - Invalid/expired `handoff_token` -> backend `401 TOKEN_INVALID`.
  - Role mismatch -> backend `403 ROLE_SCOPE_FORBIDDEN`.

### Handoff Validation Flow

1. Source app builds deep-link payload from current context.
2. Destination app validates payload schema.
3. Destination app calls `POST /api/auth/handoff/validate`.
4. On success, app exchanges context via `POST /api/auth/handoff/exchange`.
5. Session state becomes `authenticated` with destination role-bound scope.

### Unauthorized and Scope Mismatch Rules

- Manager-to-provider handoff:
  - Read-only provider context is allowed.
  - Provider mutation actions require provider role scope.
- Provider-to-manager handoff:
  - Assignment-bound property detail is allowed.
  - Manager property mutation requires manager role scope.
- Client handling:
  - Never silently degrade forbidden actions.
  - Route to deterministic fallback (`Unauthorized` or `SessionExpired`) with reason code.

## Wave 13 Provider Availability Contract

### Read Contract

- Endpoint: `GET /api/providers/{id}/availability`
- Authorized roles:
  - `provider`
  - `manager`
  - `admin`
- Response shape:
  - `data.provider_id`
  - `data.timezone`
  - `data.slots[]` with:
    - `day` (`mon`..`sun`)
    - `start` (`HH:mm`)
    - `end` (`HH:mm`)
    - `enabled` (`true|false`)
  - `meta.contract` (`provider-availability-v1`)
  - `meta.source` (`database` | `in_memory`)

### Update Contract

- Endpoint: `PATCH /api/providers/{id}/availability`
- Authorized roles:
  - `provider`
  - `admin`
- Forbidden roles:
  - `manager` -> `403 ROLE_SCOPE_FORBIDDEN`
- Request payload:
  - `timezone`
  - `slots[]` with `day`, `start`, `end`, `enabled`
- Success response:
  - `data.provider_id`
  - `data.updated_at`
  - `data.slots[]`
  - `meta.contract` (`provider-availability-v1`)
- Error response:
  - Uses existing auth/session deterministic error envelope.
  - Must include `error.code`, `meta.contract`, `meta.reason`, `meta.retryable`.

## Environment Routing Guidance

- Local (Docker Desktop):
  - Mobile app -> `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api`
  - Backend token -> `KC_MOBILE_API_TOKEN=kconecta-dev-token`
- Staging/Production:
  - Mobile app points to gateway/base domain for API.
  - Token rotated per environment and stored outside source control.

## Security Notes

- Token flow is bootstrap-only for current development wave.
- Production hardening path:
  - Replace static token with short-lived JWT or OAuth flow.
  - Store credentials with platform secure storage.
  - Add endpoint-level role scopes for manager/provider/admin.

## Backward Compatibility and Migration Notes

- Existing CRM contracts remain valid while native apps are onboarded.
- Mobile clients depend only on public API contracts, never direct DB access.
- Module internals can evolve as long as `v1` response contracts remain backward compatible.
- Migration order:
  1. Release additive `/api/auth/*` endpoints.
  2. Release additive `/api/auth/handoff/*` endpoints with role guards.
  3. Keep static token acceptance enabled during rollout.
  4. Flip clients to login/refresh plus handoff validation flow.
  5. Retire static token from mobile once all clients are migrated.
