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

## Wave 14 Provider Identity and Ownership Contract

### Session Identity Source

- `provider-app` resolves identity from authenticated session claims (`role`, `provider_id`).
- Availability requests must never rely on hardcoded provider ids in UI state.
- For provider role, backend treats path `{id}` as a requested target and validates it against session `provider_id`.

### Availability Ownership Rules

- `provider`:
  - Can read/update only its own availability.
  - Identity mismatch must return `403` with deterministic error code `PROVIDER_IDENTITY_MISMATCH`.
- `manager`:
  - Read-only visibility for provider availability context.
  - Any update attempt must return `403 ROLE_SCOPE_FORBIDDEN`.
- `admin`:
  - Can read/update availability for any provider id.

### Mobile UX Contract for Identity Errors

- `401 TOKEN_EXPIRED` / `TOKEN_INVALID`:
  - Use existing session recovery flow.
- `403 PROVIDER_IDENTITY_MISMATCH`:
  - Show ownership mismatch state.
  - Disable edit controls and provide CTA back to provider dashboard.
- `403 ROLE_SCOPE_FORBIDDEN`:
  - Keep user authenticated.
  - Show read-only state with deterministic explanation.

### Backward Compatibility

- Wave 14 keeps Wave 13 endpoint shapes unchanged:
  - `GET /api/providers/{id}/availability`
  - `PATCH /api/providers/{id}/availability`
- Contract hardening is implemented through ownership validation and error semantics, not endpoint redesign.

## Wave 15 Availability Concurrency Contract

### Read Contract Extension

- `GET /api/providers/{id}/availability` remains backward compatible.
- Response adds additive field:
  - `data.revision` (monotonic integer-like token for optimistic concurrency).
- Existing fields remain unchanged (`provider_id`, `timezone`, `slots[]`, `meta.contract`, `meta.source`).

### Update Contract Extension

- `PATCH /api/providers/{id}/availability` keeps Wave 13/14 endpoint and role rules.
- Request payload adds required field for mutation safety:
  - `revision` (last revision observed by client).
- Success response adds:
  - `data.revision` (new revision after persisted update).

### Conflict/Error Contract

- If client submits stale `revision`, backend returns:
  - `409 Conflict`
  - `error.code = AVAILABILITY_REVISION_CONFLICT`
  - `meta.contract = provider-availability-v1`
  - `meta.reason = revision_conflict`
  - `meta.retryable = true`
  - Additive context payload with server snapshot/revision for client reload.

### Mobile UX Contract for Conflicts

- On `409 AVAILABILITY_REVISION_CONFLICT`:
  - Keep user authenticated.
  - Show stale-data state with deterministic copy.
  - Disable save until latest server state is reloaded.
  - Provide CTA: `Reload Availability`, then allow `Retry Save`.

### Backward Compatibility

- Wave 15 remains additive:
  - No endpoint renames.
  - No breaking response shape removals.
  - Older clients can still read availability; update behavior without `revision` must return deterministic validation error.

## Wave 16 Manager Auth and Portfolio Contract

### Manager Session Lifecycle Rules

- Login entrypoint:
  - `POST /api/auth/login`
  - Required request fields: `email`, `password`.
  - Manager app accepts roles: `manager`, `admin`.
  - Any other role must route to deterministic unauthorized state in app.
- Refresh lifecycle:
  - `POST /api/auth/refresh` on first `401 TOKEN_EXPIRED`.
  - Retry original request once after successful refresh.
  - On refresh failure (`TOKEN_INVALID`, `TOKEN_REVOKED`), route to `SessionExpired`.
- Expired/invalid session behavior:
  - `401 TOKEN_EXPIRED` -> refresh attempt path.
  - `401 TOKEN_INVALID` / `TOKEN_REVOKED` -> hard session reset and auth entry route.
  - Session reset must clear secure storage + in-memory session cache.

### Manager Auth Error Envelope

- Auth endpoints must return deterministic envelope:
  - `error.code`
  - `error.message`
  - `meta.contract`
  - `meta.retryable`
- Minimum manager-facing codes:
  - `AUTH_INVALID_CREDENTIALS` -> login denied, retryable.
  - `TOKEN_EXPIRED` -> refresh path.
  - `TOKEN_INVALID` -> non-retryable, session reset.
  - `TOKEN_REVOKED` -> non-retryable, session reset.
  - `ROLE_SCOPE_FORBIDDEN` -> authenticated but unauthorized for manager surface.

### Manager Portfolio API Contract

- Dashboard summary contract (`GET /api/properties/summary`):
  - `data.kpis.active_properties` (number)
  - `data.kpis.reserved_properties` (number)
  - `data.kpis.avg_time_to_close_days` (number)
  - `data.kpis.provider_matches_pending` (number)
  - `meta.contract` (`manager-portfolio-summary-v1`)
- Property list contract (`GET /api/properties`):
  - Existing list payload remains backward compatible.
  - Additive filter query params:
    - `status` (optional)
    - `city` (optional)
    - `search` (optional)
    - `page` / `per_page` (optional pagination)
  - Response includes deterministic pagination metadata:
    - `meta.count`
    - `meta.page`
    - `meta.per_page`
    - `meta.total`
    - `meta.filters`

### Contract Compatibility Notes

- Wave 16 is additive for manager domain:
  - No endpoint removals.
  - No breaking field removals for existing clients.
  - New summary endpoint and list metadata are backward-compatible additions.

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
