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

## Wave 17 Manager Property Mutation Contract

### Mutation Endpoints

- Reserve property:
  - `POST /api/properties/{id}/reserve`
- Release reservation:
  - `POST /api/properties/{id}/release`
- Update operational status:
  - `PATCH /api/properties/{id}`
  - Payload includes `status` (`available|reserved|maintenance`) and optional mutation metadata.

### Authorization and Ownership Rules

- Allowed roles:
  - `manager`
  - `admin`
- Forbidden roles:
  - `provider` -> `403 ROLE_SCOPE_FORBIDDEN`
- Ownership baseline:
  - `manager` mutates manager-scoped properties.
  - `admin` may mutate across manager scopes.

### Deterministic Error Envelope (Mutations)

- `401 TOKEN_EXPIRED`
  - Client performs one refresh attempt.
- `401 TOKEN_INVALID` or `TOKEN_REVOKED`
  - Client resets session and routes to auth entry.
- `403 ROLE_SCOPE_FORBIDDEN`
  - Keep session active; show unauthorized manager action state.
- `409 PROPERTY_STATE_CONFLICT`
  - Keep session active; show stale/conflict action state and prompt data reload.
- `422 VALIDATION_ERROR`
  - Keep current screen and show action-level validation feedback.

### Backward Compatibility

- Wave 17 is additive:
  - Existing read contracts remain unchanged (`GET /api/properties`, `GET /api/properties/{id}`, `GET /api/properties/summary`).
  - Mutation contracts are new manager-facing capabilities and do not remove prior fields.

## Wave 18 Manager Auth Hardening and Property Form Contract

### Manager Auth Session Hardening Rules

- Login endpoint remains:
  - `POST /api/auth/login`
- Refresh endpoint remains:
  - `POST /api/auth/refresh`
- Logout endpoint remains:
  - `POST /api/auth/logout`
- Hardening expectations:
  - Client performs at most one refresh retry per failed request chain.
  - Parallel API calls must not trigger concurrent refresh storms; one refresh operation owns token rotation.
  - Refresh failure (`TOKEN_INVALID`, `TOKEN_REVOKED`) forces deterministic re-auth state and local credential wipe.
  - Successful logout invalidates local access + refresh tokens and resets manager navigation stack to auth entry.

### Manager Property Create/Edit Contract

- Create property:
  - `POST /api/properties`
  - Required payload:
    - `title` (string, 3..160)
    - `city` (string, 2..120)
    - `status` (`available|reserved|maintenance`)
  - Optional payload:
    - `price` (number >= 0)
    - `manager_id` (string; ignored for manager role unless admin scope allows explicit override)
- Edit property:
  - `PATCH /api/properties/{id}`
  - Allowed mutable fields in Wave 18:
    - `title`
    - `city`
    - `status`
    - `price`
  - `id` remains immutable.

### Validation/Error Envelope for Native Forms

- Validation failures must return:
  - `422`
  - `error.code = VALIDATION_ERROR`
  - `error.message`
  - `error.fields` map keyed by field name (array of messages)
  - `meta.contract = manager-property-form-v1`
  - `meta.retryable = true`
- Role violations:
  - `403 ROLE_SCOPE_FORBIDDEN`
- Session invalidation:
  - `401 TOKEN_EXPIRED` (refresh path)
  - `401 TOKEN_INVALID|TOKEN_REVOKED` (forced re-auth)

### Backward Compatibility

- Wave 18 keeps existing Wave 16/17 read and mutation endpoints operational.
- `PATCH /api/properties/{id}` remains backward compatible for status-only clients.
- New create endpoint and additive validation metadata are non-breaking additions.

## Wave 19 Manager Provider Handoff and Assignment Contract

### Provider Candidate Discovery Contract

- Endpoint:
  - `GET /api/properties/{id}/provider-candidates`
- Allowed roles:
  - `manager`
  - `admin`
- Response shape:
  - `data.property_id`
  - `data.candidates[]` with:
    - `id`
    - `name`
    - `category`
    - `city`
    - `status`
    - `rating`
  - `meta.contract = manager-provider-handoff-v1`
  - `meta.source = database|in_memory`

### Provider Assignment Mutation Contract

- Endpoint:
  - `POST /api/properties/{id}/assign-provider`
- Allowed roles:
  - `manager`
  - `admin`
- Request payload:
  - `provider_id` (required integer)
  - `note` (optional string)
- Success response:
  - `data.property_id`
  - `data.provider_id`
  - `data.assigned_at` (ISO-8601)
  - `meta.contract = manager-provider-handoff-v1`
  - `meta.reason = provider_assigned`
- Conflict/validation/error responses:
  - `422 VALIDATION_ERROR` with deterministic field map
  - `404 PROPERTY_NOT_FOUND` or `PROVIDER_NOT_FOUND`
  - `409 ASSIGNMENT_CONFLICT` for stale or incompatible state
  - `403 ROLE_SCOPE_FORBIDDEN` for unauthorized roles

### Handoff Session and Security Rules

- Assignment flow inherits Wave 18 auth hardening:
  - one refresh retry on `TOKEN_EXPIRED`
  - forced re-auth on `TOKEN_INVALID`/`TOKEN_REVOKED`
- Manager app must not embed hardcoded provider ids in handoff requests.
- Provider role cannot call manager assignment endpoints.

### Wave 19 Backward Compatibility

- Wave 19 adds handoff endpoints; no existing endpoint removals.
- Wave 16-18 dashboard, property mutation, and property form contracts remain valid.

## Wave 20 Manager Login-First and Session Introspection Contract

### Login-First Bootstrap Rules

- Manager app startup no longer assumes env token as primary session source.
- Startup decision tree:
  1. No persisted token -> route to `Login`.
  2. Persisted token present -> validate with `GET /api/auth/me`.
  3. `auth/me` success -> enter manager dashboard shell.
  4. `401 TOKEN_EXPIRED` -> one refresh attempt, then retry `auth/me`.
  5. `401 TOKEN_INVALID|TOKEN_REVOKED` -> clear session and route to `SessionExpired`.
  6. `403 ROLE_SCOPE_FORBIDDEN` -> route to `Unauthorized`.

### Session Introspection Contract

- Endpoint:
  - `GET /api/auth/me`
- Success response:
  - `data.role`
  - `data.scope[]`
  - `data.subject` (session principal id/email)
  - `meta.contract = auth-session-v1`
- Error response:
  - same deterministic envelope used by auth lifecycle routes:
    - `error.code`
    - `error.message`
    - `meta.contract`
    - `meta.flow`
    - `meta.reason`
    - `meta.retryable`

### Compatibility and Rollout

- Dev diagnostics mode may keep env-token bootstrap as explicit fallback only.
- Production path must use login + persisted token + auth/me validation.
- Wave 20 remains additive and backward compatible with Wave 16-19 manager/provider contracts.

## Wave 21 Manager Assignment Context Contract

### Assignment Context Endpoint

- Endpoint:
  - `GET /api/properties/{id}/assignment-context`
- Allowed roles:
  - `manager`
  - `admin`
- Forbidden roles:
  - `provider` -> `403 ROLE_SCOPE_FORBIDDEN`
- Unauthorized session:
  - Deterministic `401` envelope using `auth-session-v1` contract.

### Success Payload Contract

- `data.property_id`
- `data.assignment.assigned` (`true|false`)
- `data.assignment.provider`:
  - `id`
  - `name`
  - `category`
  - `city`
  - `status`
  - `rating`
- `data.assignment.assigned_at` (nullable ISO-8601)
- `data.assignment.note` (nullable string)
- `data.assignment.state`:
  - `unassigned`
  - `assigned`
  - `provider_missing`
- `meta.contract = manager-provider-context-v1`
- `meta.flow = properties_assignment_context`
- `meta.reason`:
  - `assignment_context_loaded`
  - `property_not_found`

### Mobile Consumption Rules

- Manager property detail must render assignment context as an additive card.
- Handoff success should trigger context refresh to avoid stale provider ownership display.
- If `state=provider_missing`, UI must keep manager session active and show deterministic warning copy (no silent fallback).

### Backward Compatibility

- Wave 21 is additive:
  - Existing Wave 19 endpoints remain unchanged:
    - `GET /api/properties/{id}/provider-candidates`
    - `POST /api/properties/{id}/assign-provider`
  - Existing Wave 16-20 payload fields are untouched.

## Wave 22 Manager Portfolio Filters and Pagination Contract

### Portfolio Query Contract

- Endpoint:
  - `GET /api/properties`
- Allowed roles:
  - `manager`
  - `admin`
- Additive query params:
  - `search` (optional string)
  - `status` (optional: `available|reserved|maintenance`)
  - `city` (optional string)
  - `page` (optional integer, default `1`)
  - `per_page` (optional integer, bounded max)

### Deterministic Response Metadata

- Response keeps existing `data` collection and extends `meta` with:
  - `page`
  - `per_page`
  - `total`
  - `total_pages`
  - `has_next_page`
  - `filters` (echo of effective filters)
  - `source` (`database|in_memory`)

### Error and Guardrail Semantics

- `401 TOKEN_EXPIRED` -> refresh path.
- `401 TOKEN_INVALID|TOKEN_REVOKED` -> deterministic session reset.
- `403 ROLE_SCOPE_FORBIDDEN` for unauthorized roles.
- `422 VALIDATION_ERROR` for invalid filter/pagination params.

### Compatibility Notes

- Wave 22 is additive:
  - no endpoint removals
  - no breaking removals in existing portfolio payload fields
  - existing list consumers remain valid with default params

## Wave 23 Manager Property Detail Timeline Contract

### Property Detail Timeline Endpoint Contract

- Endpoint:
  - `GET /api/properties/{id}`
- Allowed roles:
  - `manager`
  - `admin`
- Additive timeline payload:
  - `data.timeline[]` sorted by descending `occurred_at`.
  - Event shape:
    - `id` (stable event identifier)
    - `type` (`assignment`, `status_change`, `note`)
    - `occurred_at` (ISO-8601 UTC)
    - `actor` (`system`, `manager`, `admin`)
    - `summary` (short deterministic copy)
    - `metadata` (object with type-specific fields)

### Timeline Event Taxonomy

- `assignment`:
  - `metadata.provider_id`
  - `metadata.provider_name`
  - `metadata.assignment_state` (`assigned|reassigned|unassigned`)
- `status_change`:
  - `metadata.previous_status`
  - `metadata.next_status`
- `note`:
  - `metadata.note`
  - `metadata.scope` (`handoff|property`)

### Deterministic Error and Guardrail Semantics

- `401 TOKEN_EXPIRED` -> refresh path.
- `401 TOKEN_INVALID|TOKEN_REVOKED` -> deterministic session reset.
- `403 ROLE_SCOPE_FORBIDDEN` for unauthorized roles.
- `404 PROPERTY_NOT_FOUND` with deterministic envelope metadata.

### Compatibility Notes

- Wave 23 is additive:
  - no endpoint removals
  - timeline field is additive in `GET /api/properties/{id}`
  - existing detail consumers remain valid when timeline is not rendered

## Wave 24 Manager Dashboard Summary and Priorities Contract

### Dashboard Summary Endpoint Contract

- Endpoint:
  - `GET /api/properties/summary`
- Allowed roles:
  - `manager`
  - `admin`
- Response shape:
  - `data.kpis`:
    - `active_properties` (number)
    - `reserved_properties` (number)
    - `avg_time_to_close_days` (number)
    - `provider_matches_pending` (number)
  - `data.priorities[]`:
    - `id` (stable item id)
    - `category` (`portfolio_review|provider_assignment|maintenance_follow_up|quality_alert`)
    - `title` (deterministic short label)
    - `description` (deterministic actionable summary)
    - `severity` (`low|medium|high`)
    - `due_at` (nullable ISO-8601 UTC)
    - `updated_at` (ISO-8601 UTC)
  - `meta.contract = manager-dashboard-summary-v1`
  - `meta.generated_at` (ISO-8601 UTC)
  - `meta.source` (`database|in_memory`)

### Priorities Taxonomy and Timestamp Semantics

- `category` is deterministic and backend-owned.
- `updated_at` represents the latest upstream state transition affecting the priority item.
- `due_at` represents operational target date and may be null.
- Client sorting contract:
  - Primary: `severity` (`high` > `medium` > `low`)
  - Secondary: ascending `due_at` (nulls last)
  - Tertiary: descending `updated_at`

### Error and Guardrail Semantics

- `401 TOKEN_EXPIRED` -> one refresh attempt path.
- `401 TOKEN_INVALID|TOKEN_REVOKED` -> deterministic session reset.
- `403 ROLE_SCOPE_FORBIDDEN` for unauthorized roles.
- Response envelope remains consistent with prior manager auth/session contracts.

### Compatibility Notes

- Wave 24 is additive:
  - no endpoint removals
  - `data.kpis` remains backward compatible
  - `data.priorities[]` and `meta.generated_at` are additive fields

## Wave 25 Manager Priority Queue and SLA Contract

### Manager Priority Queue Endpoint Contract

- Endpoint:
  - `GET /api/properties/priorities/queue`
- Allowed roles:
  - `manager`
  - `admin`
- Additive query params:
  - `category` (optional: `provider_assignment|maintenance_follow_up|portfolio_review|quality_alert`)
  - `severity` (optional: `high|medium|low`)
  - `limit` (optional integer, bounded max)
- Response shape:
  - `data.items[]`:
    - `id` (stable queue item id)
    - `property_id` (number)
    - `property_title` (string)
    - `city` (string)
    - `status` (string)
    - `category` (queue taxonomy category)
    - `severity` (`high|medium|low`)
    - `sla_due_at` (nullable ISO-8601 UTC)
    - `sla_state` (`on_track|at_risk|overdue|no_deadline`)
    - `updated_at` (ISO-8601 UTC)
    - `action` (`open_property|open_handoff|review_status`)
  - `meta.contract = manager-priority-queue-v1`
  - `meta.generated_at` (ISO-8601 UTC)
  - `meta.source` (`database|in_memory`)
  - `meta.filters` (echo of effective query filters)

### Deterministic Queue Ordering Rules

- Client-visible ordering is backend-owned:
  - Primary: `severity` (`high` > `medium` > `low`)
  - Secondary: ascending `sla_due_at` (`null` values last)
  - Tertiary: descending `updated_at`
  - Final tie-breaker: ascending `id`
- Queue ordering must remain deterministic for identical filter inputs.

### Error and Guardrail Semantics

- `401 TOKEN_EXPIRED`:
  - one refresh attempt path.
- `401 TOKEN_INVALID|TOKEN_REVOKED`:
  - deterministic session reset.
- `403 ROLE_SCOPE_FORBIDDEN`:
  - unauthorized roles cannot access manager queue.
- `422 VALIDATION_ERROR`:
  - invalid queue filter parameters.

### Compatibility Notes

- Wave 25 is additive:
  - no endpoint removals
  - Wave 24 dashboard summary contract remains unchanged
  - queue endpoint extends manager dashboard parity without breaking prior consumers

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
