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

## Wave 26 Manager Priority Queue Action Completion Contract

### Queue Action Completion Endpoint Contract

- Endpoint:
  - `POST /api/properties/priorities/queue/{queue_item_id}/complete`
- Allowed roles:
  - `manager`
  - `admin`
- Request shape (additive):
  - `note` (optional string, max length bounded)
  - `resolution_code` (optional enum: `assigned|deferred|resolved|dismissed`)
- Response shape:
  - `data.item`:
    - `id` (queue item id)
    - `property_id` (number)
    - `category` (queue taxonomy category)
    - `severity` (`high|medium|low`)
    - `action` (`open_property|open_handoff|review_status`)
    - `completed` (boolean)
    - `completed_at` (ISO-8601 UTC)
    - `resolution_code` (nullable string)
    - `note` (nullable string)
    - `updated_at` (ISO-8601 UTC)
  - `meta.contract = manager-priority-queue-action-v1`
  - `meta.flow = properties_priority_queue_complete`
  - `meta.reason` (`queue_item_completed|validation_error|queue_item_not_found|queue_conflict`)
  - `meta.retryable` (boolean)

### Queue Action Guardrail Semantics

- `401 TOKEN_EXPIRED`:
  - one refresh attempt path, then session-expired fallback.
- `401 TOKEN_INVALID|TOKEN_REVOKED`:
  - deterministic hard session reset.
- `403 ROLE_SCOPE_FORBIDDEN`:
  - provider role cannot mutate manager queue state.
- `404 QUEUE_ITEM_NOT_FOUND`:
  - unknown queue id returns deterministic not-found envelope.
- `409 QUEUE_ACTION_CONFLICT`:
  - already-completed or stale queue action mutation.
- `422 VALIDATION_ERROR`:
  - invalid `resolution_code`/`note` payload validation.

### Compatibility Notes

- Wave 26 is additive:
  - no endpoint removals
  - `GET /api/properties/priorities/queue` contract remains stable
  - completion endpoint only enriches manager action loop without breaking Wave 24/25 consumers

## Wave 27 Manager Property Form Parity Contract

### Manager Property Create/Edit Endpoint Contract

- Endpoints:
  - `POST /api/properties`
  - `PATCH /api/properties/{id}`
- Allowed roles:
  - `manager`
  - `admin`
- Request shape (additive target contract):
  - `title` (required string)
  - `description` (required string)
  - `address` (required string)
  - `city` (required string)
  - `postal_code` (required string)
  - `status` (required enum: `available|reserved|maintenance`)
  - `property_type` (required stable slug or catalog id)
  - `operation_mode` (required enum: `sale|rent|both`)
  - `sale_price` (nullable numeric, required when `operation_mode` includes `sale`)
  - `rental_price` (nullable numeric, required when `operation_mode` includes `rent`)
  - `garage_price_category_id` (nullable catalog id, conditional for garage inventory)
  - `garage_price` (nullable numeric, required when `garage_price_category_id` is present)
  - `bedrooms` (nullable integer, required for residential property types)
  - `bathrooms` (nullable integer, required for residential property types)
  - `rooms` (nullable integer)
  - `elevator` (nullable boolean)
  - `manager_id` (nullable string, server-owned default for manager role)
- Success response shape:
  - `data.property`:
    - `id` (number)
    - `title` (string)
    - `description` (string)
    - `address` (string)
    - `city` (string)
    - `postal_code` (string)
    - `status` (`available|reserved|maintenance`)
    - `property_type` (stable slug or resolved catalog object)
    - `operation_mode` (`sale|rent|both`)
    - `pricing`:
      - `sale_price` (nullable numeric)
      - `rental_price` (nullable numeric)
      - `garage_price_category_id` (nullable number)
      - `garage_price` (nullable numeric)
    - `characteristics`:
      - `bedrooms` (nullable integer)
      - `bathrooms` (nullable integer)
      - `rooms` (nullable integer)
      - `elevator` (nullable boolean)
    - `manager_id` (string)
    - `updated_at` (ISO-8601 UTC)
  - `meta.contract = manager-property-form-v1`
  - `meta.flow = properties_create|properties_update`
  - `meta.reason = property_created|property_updated`
  - `meta.source = database|in_memory`

### Deterministic Validation Semantics

- Required field validation:
  - During rollout, the enriched form fields are accepted additively and legacy minimal manager payloads remain valid.
  - Once Wave 27 contract enforcement is enabled on the backend, empty `title`, `description`, `address`, `city`, `postal_code`, `property_type`, `operation_mode`, or `status` returns `422 VALIDATION_ERROR`.
- Conditional pricing validation:
  - `sale_price` required for `sale|both`.
  - `rental_price` required for `rent|both`.
  - `garage_price` required when `garage_price_category_id` is present.
- Numeric validation:
  - price fields must be numeric and non-negative.
  - `bedrooms`, `bathrooms`, and `rooms` must be integers and non-negative.
- Enum validation:
  - `status` and `operation_mode` must map to allowed enums only.
- Role validation:
  - manager role cannot override another manager through arbitrary `manager_id`.
- Error envelope mapping:
  - `error.code = VALIDATION_ERROR`
  - `error.fields` uses backend-owned field keys that match mobile inputs exactly.
  - Example keys:
    - `title`
    - `description`
    - `address`
    - `city`
    - `postal_code`
    - `property_type`
    - `operation_mode`
    - `sale_price`
    - `rental_price`
    - `garage_price_category_id`
    - `garage_price`
    - `bedrooms`
    - `bathrooms`
    - `rooms`
    - `status`

### Error and Guardrail Semantics

- `401 TOKEN_EXPIRED`:
  - one refresh attempt path before session-expired fallback.
- `401 TOKEN_INVALID|TOKEN_REVOKED`:
  - deterministic hard session reset.
- `403 ROLE_SCOPE_FORBIDDEN`:
  - provider role or unauthorized manager scope cannot create/edit property inventory.
- `404 PROPERTY_NOT_FOUND`:
  - edit flow target is missing or inaccessible.
- `409 PROPERTY_STATE_CONFLICT`:
  - stale update or ownership/version conflict on edit.
- `422 VALIDATION_ERROR`:
  - deterministic field-level validation mapping for mobile form rendering.

### Compatibility Notes

- Wave 27 is additive:
  - current minimal title/city/status/price payload remains backward compatible during rollout.
  - enriched contract extends property form parity without breaking Wave 22-26 manager flows.
  - detail/list/dashboard consumers may continue using their current read models while editor payload expands.

## Wave 28 Manager Auth/Session UX Hardening Contract

### Manager Login UX Rules

- Manager login remains:
  - `POST /api/auth/login`
- Native manager login must default to blank credentials unless explicit bootstrap env values are provided for local diagnostics.
- Production-shaped flow assumptions:
  - env bootstrap credentials are optional debug-only helpers, not the primary contract.
  - login screen must not rely on hidden defaults to enter the manager shell.

### Success Contract Hardening

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- Successful manager-facing auth responses must remain aligned under `auth-session-v1` and provide:
  - `data.access_token` where applicable
  - `data.refresh_token` where applicable
  - `data.role`
  - `data.scope[]`
  - `data.subject`
  - `data.email`
  - `data.display_name` (nullable/additive)
  - `meta.contract = auth-session-v1`
  - `meta.flow = login|refresh|me`
  - `meta.reason = login_success|refresh_success|session_resolved`

### Failure Envelope and Recovery Rules

- Validation failure:
  - `422 VALIDATION_ERROR`
  - field-level feedback remains deterministic for `email` and `password` inputs.
- Invalid credentials:
  - `401 INVALID_CREDENTIALS`
  - keep user on login screen
  - preserve email input
  - never enter authenticated shell
- Session restore:
  - persisted token present -> `GET /api/auth/me`
  - `401 TOKEN_EXPIRED` -> one `refresh` attempt, then retry `me`
  - unrecoverable `401 TOKEN_INVALID|TOKEN_REVOKED` -> clear session and route to `SessionExpired`
  - `403 ROLE_SCOPE_FORBIDDEN` -> keep session state explicit and route to `Unauthorized`

### Compatibility Notes

- Wave 28 is additive over Wave 20 session parity:
  - no endpoint removals
  - no breaking removal of existing token fields
  - success metadata is enriched so manager mobile can render deterministic login/session UX without dev-first assumptions

## Wave 29 Manager Provider Handoff Evidence Contract

### Assignment Success Evidence Rules

- Endpoint remains:
  - `POST /api/properties/{id}/assign-provider`
- Allowed roles remain:
  - `manager`
  - `admin`
- Existing success fields remain backward compatible:
  - `data.property_id`
  - `data.provider_id`
  - `data.assigned_at`
  - `data.property`
  - `meta.contract = manager-provider-handoff-v1`
  - `meta.flow = properties_assign_provider`
  - `meta.reason = provider_assigned`

### Additive Success Payload

- Success response adds assignment evidence so manager mobile can confirm mutation outcome without a follow-up property-detail fetch:
  - `data.assignment`
    - `assigned` (`true`)
    - `state` (`assigned`)
    - `assigned_at` (ISO-8601 UTC)
    - `note` (nullable string)
    - `provider`
      - `id`
      - `name`
      - `category`
      - `city`
      - `status`
      - `rating`
  - `data.latest_timeline_event`
    - `id`
    - `type` (`assignment`)
    - `occurred_at` (ISO-8601 UTC)
    - `actor`
    - `summary`
    - `metadata`

### Mobile Consumption Rules

- Manager handoff screen must treat `assign-provider` response as the primary success source.
- Mobile must not require `GET /api/properties/{id}` immediately after assignment just to render success evidence.
- Property detail refresh remains allowed after navigation, but it is a secondary consistency step, not a success prerequisite.
- If additive evidence fields are missing during rollout:
  - use existing success path
  - mark response as partial evidence in diagnostics-only mode
  - keep navigation deterministic back to property detail

### Error and Recovery Semantics

- `401 TOKEN_EXPIRED`
  - one refresh attempt path, then retry assignment once.
- `401 TOKEN_INVALID|TOKEN_REVOKED`
  - clear session and route to `SessionExpired`.
- `403 ROLE_SCOPE_FORBIDDEN`
  - keep authenticated state explicit and route to `Unauthorized`.
- `409 ASSIGNMENT_CONFLICT`
  - keep manager on handoff surface.
  - preserve selected provider + note input.
  - show deterministic reload/retry CTA.
- `422 VALIDATION_ERROR`
  - keep current inputs and show deterministic validation copy.

### Compatibility Notes

- Wave 29 is additive over Wave 19 and Wave 21:
  - no endpoint removals
  - no breaking field removals from `manager-provider-handoff-v1`
  - `assignment` and `latest_timeline_event` are additive fields in assignment success payload

## Wave 30 Manager Provider Directory and Profile Contract

### Provider Directory Read Contract

- Endpoint:
  - `GET /api/providers`
- Allowed roles:
  - `manager`
  - `admin`
- Provider role behavior:
  - existing provider self-service reads remain valid for provider runtime
  - manager directory contract must not require provider-role tokens
- Request query parameters:
  - `search` (free-text, optional)
  - `city` (optional)
  - `category` (optional)
  - `status` (optional)
  - `page` (optional, integer)
  - `per_page` (optional, integer)
- Success response minimum shape:
  - `data[]`
    - `id`
    - `name`
    - `category`
    - `city`
    - `status`
    - `rating`
    - `availability_summary`
      - `label`
      - `next_open_slot` (nullable)
    - `services_preview[]`
  - `meta.contract = manager-provider-directory-v1`
  - `meta.filters`
  - `meta.pagination`
  - `meta.source`

### Provider Profile Detail Contract

- Endpoint:
  - `GET /api/providers/{id}`
- Allowed roles:
  - `manager`
  - `admin`
- Success response minimum shape:
  - `data.id`
  - `data.name`
  - `data.category`
  - `data.city`
  - `data.status`
  - `data.rating`
  - `data.bio` (nullable)
  - `data.phone` (nullable/masked by policy)
  - `data.email` (nullable/masked by policy)
  - `data.services[]`
  - `data.coverage[]`
  - `data.availability_summary`
  - `data.metrics`
    - `completed_jobs`
    - `response_time_hours`
    - `customer_score`
  - `meta.contract = manager-provider-directory-v1`
  - `meta.source`

### Manager Mobile Consumption Rules

- Manager directory and provider profile remain read-only surfaces in Wave 30.
- Manager app must be able to render provider list cards from `GET /api/providers` without composing profile data from unrelated property or handoff payloads.
- Provider profile screen must accept list payload as preview context, but authoritative detail rendering comes from `GET /api/providers/{id}`.
- Empty list responses are valid business outcomes and must not be treated as transport failures.

### Error and Recovery Semantics

- `401 TOKEN_EXPIRED`
  - one refresh attempt, then retry current read once.
- `401 TOKEN_INVALID|TOKEN_REVOKED`
  - clear session and route to `SessionExpired`.
- `403 ROLE_SCOPE_FORBIDDEN`
  - keep authenticated state explicit and route to `Unauthorized`.
- `404 PROVIDER_NOT_FOUND`
  - keep manager app authenticated and render deterministic profile not-found state.
- transport/server errors
  - keep current screen mounted and expose retry CTA without clearing filter state.

### Compatibility Notes

- Wave 30 is additive over existing provider reads and manager parity flows:
  - no endpoint removals
  - no breaking removal of provider detail fields already consumed by provider runtime
  - `manager-provider-directory-v1` standardizes manager-facing list/detail payload expectations without changing auth lifecycle contracts

## Wave 31 Manager Assignment Center Contract

### Manager Assignment Center Read Contract

- Endpoints:
  - `GET /api/properties/priorities/queue`
  - `GET /api/properties/priorities/queue/{queueItemId}`
  - `POST /api/properties/priorities/queue/{queueItemId}/complete`
- Allowed roles:
  - `manager`
  - `admin`
- Queue list request query parameters:
  - `category` (optional)
  - `severity` (optional)
  - `status` (optional)
  - `search` (optional)
  - `limit` (optional integer)
- Queue list success response minimum shape:
  - `data.items[]`
    - `id`
    - `category`
    - `severity`
    - `action`
    - `status`
    - `property_id`
    - `property_title`
    - `provider_id` (nullable)
    - `provider_name` (nullable)
    - `city`
    - `due_at` (nullable)
    - `summary`
    - `description`
    - `completed`
    - `completed_at` (nullable)
  - `meta.contract = manager-priority-queue-v1`
  - `meta.flow = properties_priority_queue`
  - `meta.filters`
  - `meta.source`
  - existing Wave 25 queue envelope remains backward-compatible; Wave 31 only extends additive filters and additive item fields for assignment-center consumers

### Manager Assignment Detail Contract

- Endpoint:
  - `GET /api/properties/priorities/queue/{queueItemId}`
- Success response minimum shape:
  - `data.id`
  - `data.category`
  - `data.severity`
  - `data.status`
  - `data.action`
  - `data.property`
    - `id`
    - `title`
    - `status`
    - `city`
  - `data.provider` (nullable)
    - `id`
    - `name`
    - `status`
  - `data.assignment`
    - `state`
    - `assigned`
    - `assigned_at` (nullable)
    - `note` (nullable)
  - `data.timeline[]`
    - `id`
    - `type`
    - `summary`
    - `occurred_at`
    - `actor`
  - `meta.contract = manager-assignment-center-v1`
  - `meta.flow = properties_priority_queue_detail`
  - `meta.reason`

### Queue Action Contract

- Endpoint:
  - `POST /api/properties/priorities/queue/{queueItemId}/complete`
- Action success response minimum shape:
  - `data.item.id`
  - `data.item.completed = true`
  - `data.item.completed_at`
  - `data.item.resolution_code`
  - `meta.contract = manager-priority-queue-action-v1`
  - `meta.flow = properties_priority_queue_complete`
  - `meta.reason`
- Guardrail semantics preserved for assignment-center consumers:
  - `409 QUEUE_ACTION_CONFLICT`
    - stale/already-completed queue action remains a deterministic conflict response
    - mobile state `assignment_action_conflict` must continue to map to refresh/retry recovery

### Manager Mobile Consumption Rules

- Assignment center is a dedicated manager workspace, not a replacement for dashboard priorities.
- Dashboard can deep-link into assignment center filtered context, but assignment center becomes the authoritative surface for queue review and queue-item detail.
- Manager app must not infer assignment detail by stitching unrelated property-detail and provider-directory reads when the queue detail endpoint is available.
- Queue list filters must survive refresh, retry, and back-navigation from assignment detail.

### Error and Recovery Semantics

- `401 TOKEN_EXPIRED`
  - one refresh attempt, then retry current queue read/action once.
- `401 TOKEN_INVALID|TOKEN_REVOKED`
  - clear session and route to `SessionExpired`.
- `403 ROLE_SCOPE_FORBIDDEN`
  - keep authenticated state explicit and route to `Unauthorized`.
- `404 QUEUE_ITEM_NOT_FOUND`
  - keep manager app authenticated and render deterministic missing-assignment state.
- `422 VALIDATION_ERROR`
  - keep current resolution inputs and expose validation copy in place.
- transport/server errors
  - keep current assignment center context mounted and expose retry CTA without clearing filters.

### Compatibility Notes

- Wave 31 is additive over Wave 24, Wave 29, and Wave 30:
  - no endpoint removals
  - no breaking field removals from dashboard priority queue payloads
  - `manager-assignment-center-v1` standardizes manager queue list/detail/action expectations without changing existing handoff mutation contracts

## Wave 32 Manager Assignment Status Management Contract

### Assignment Status Mutation Contract

- Endpoint:
  - `PATCH /api/properties/priorities/queue/{queueItemId}/assignment`
- Allowed roles:
  - `manager`
  - `admin`
- Request payload minimum shape:
  - `action` (`complete|reassign|cancel`)
  - `provider_id` (required only when `action = reassign`)
  - `note` (optional)
- Success response minimum shape:
  - `data.id`
  - `data.status`
  - `data.assignment`
    - `state`
    - `assigned`
    - `assigned_at` (nullable)
    - `completed_at` (nullable)
    - `cancelled_at` (nullable)
    - `provider_id` (nullable)
    - `provider_name` (nullable)
  - `data.available_actions[]`
  - `meta.contract = manager-assignment-status-v1`
  - `meta.flow = properties_priority_queue_assignment_update`
  - `meta.reason`

### Reassign Provider Contract

- Reassign provider options must reuse the existing manager provider directory contract:
  - `GET /api/providers`
  - `GET /api/providers/{providerId}`
- Wave 32 must not introduce an alternative provider source for reassignment.
- Reassign action remains additive:
  - it consumes provider directory data as read-model input
  - it mutates assignment ownership only through the assignment status endpoint above

### Error and Guardrail Semantics

- `401 TOKEN_EXPIRED`
  - one refresh attempt, then retry mutation once.
- `401 TOKEN_INVALID|TOKEN_REVOKED`
  - clear session and route to `SessionExpired`.
- `403 ROLE_SCOPE_FORBIDDEN`
  - provider role or out-of-scope manager mutation remains blocked.
- `404 QUEUE_ITEM_NOT_FOUND`
  - unknown queue item id returns deterministic missing-item envelope.
- `409 ASSIGNMENT_ACTION_CONFLICT`
  - requested transition is invalid for current assignment state.
- `422 VALIDATION_ERROR`
  - invalid `action`, invalid `provider_id`, or incompatible payload shape.

### Compatibility Notes

- Wave 32 is additive over Wave 31:
  - queue list and queue detail contracts remain stable
  - provider directory contracts remain stable
  - assignment status mutation only extends manager assignment workflows from the existing detail surface

## Wave 33 Manager Assignment Media Evidence Contract

### Assignment Evidence Media Contracts

- Endpoints:
  - `GET /api/properties/priorities/queue/{queueItemId}/evidence`
  - `POST /api/properties/priorities/queue/{queueItemId}/evidence`
- Allowed roles:
  - `manager`
  - `admin`
- Upload request minimum shape:
  - multipart field `file`
  - `category` (`before_photo|after_photo|invoice|report|permit|other`)
  - `note` (optional)
- Evidence list item minimum shape:
  - `id`
  - `file_name`
  - `media_type`
  - `category`
  - `size_bytes`
  - `uploaded_by`
  - `uploaded_at`
  - `preview_url` (nullable)
  - `download_url`
- Success response minimum shape:
  - `data.items[]`
  - `data.count`
  - `meta.contract = manager-assignment-evidence-v1`
  - `meta.flow = properties_priority_queue_assignment_evidence`
  - `meta.reason`

### Manager Mobile Consumption Rules

- Assignment detail remains the host surface for evidence upload and review.
- Media/document evidence is additive over the existing assignment detail payload:
  - do not remove current assignment state, provider snapshot, or timeline fields
  - evidence list refresh must not require re-entering assignment detail
- Mobile must not talk directly to storage infrastructure:
  - binary upload is mediated only by backend API
  - download/preview URLs are backend-issued and scope-aware

### Error and Recovery Semantics

- `401 TOKEN_EXPIRED`
  - one refresh attempt, then retry upload/list request once.
- `401 TOKEN_INVALID|TOKEN_REVOKED`
  - clear session and route to `SessionExpired`.
- `403 ROLE_SCOPE_FORBIDDEN`
  - authenticated but unauthorized manager/provider state routes to `Unauthorized`.
- `404 QUEUE_ITEM_NOT_FOUND`
  - render deterministic missing-assignment state and preserve CTA back to assignment center.
- `413 FILE_TOO_LARGE`
  - keep current assignment detail mounted and show upload-specific validation copy.
- `415 UNSUPPORTED_MEDIA_TYPE`
  - preserve current evidence list and show unsupported-file guidance inline.
- `422 VALIDATION_ERROR`
  - keep selected upload intent mounted and expose field/action-level validation copy.
- transport/server errors
  - preserve current evidence list and allow retry without resetting assignment detail context.

### Compatibility Notes

- Wave 33 is additive over Waves 29, 31, and 32:
  - Wave 29 assignment evidence payload remains the confirmation contract for handoff mutation success
  - Wave 31 queue list/detail contracts remain stable
  - Wave 32 assignment status actions remain stable
- Wave 33 introduces media/document evidence as a separate evidence collection contract, not a replacement for prior assignment state evidence.

## Wave 34 Manager Provider Profile Scorecard Contract

### Queue-Aware Provider Profile Contract

- Endpoint:
  - `GET /api/providers/{id}?queue_item_id={queueItemId}`
- Allowed roles:
  - `manager`
  - `admin`
- Baseline profile behavior:
  - Missing `queue_item_id` must keep Wave 30 provider profile contract stable.
  - Existing provider detail fields remain unchanged for non-assignment browsing flows.

### Additive Assignment Fit Payload

- When `queue_item_id` is provided and resolves successfully, response adds:
  - `data.assignment_fit`
    - `recommended` (`true|false`)
    - `score_label` (string)
    - `match_reasons[]` (string list)
    - `warnings[]` (string list)
    - `next_action` (nullable string)
- `assignment_fit` is additive:
  - It must not replace `services`, `coverage`, `availability_summary`, or `metrics`.
  - It is optional only when no queue context was requested.

### Guardrails and Error Semantics

- `401 TOKEN_EXPIRED`
  - one refresh attempt path, then retry profile read once.
- `401 TOKEN_INVALID|TOKEN_REVOKED`
  - clear session and route to `SessionExpired`.
- `403 ROLE_SCOPE_FORBIDDEN`
  - keep authenticated state explicit and route to `Unauthorized`.
- `404 PROVIDER_NOT_FOUND`
  - deterministic missing-provider state for manager profile.
- `404 QUEUE_ITEM_NOT_FOUND`
  - deterministic missing assignment-context state when `queue_item_id` does not resolve.

### Compatibility Notes

- Wave 34 is additive over Wave 30 and Wave 31:
  - no endpoint removals
  - no breaking provider detail field removals
  - assignment-aware scorecard metadata is only added when queue context is requested

## Wave 35 Manager Assignment Decision Timeline Contract

### Assignment Detail Additive Contract

- Endpoint:
  - `GET /api/properties/priorities/queue/{queueItemId}`
- Allowed roles:
  - `manager`
  - `admin`
- Baseline behavior:
  - existing assignment detail fields remain stable
  - existing `timeline[]` remains available to current consumers

### Additive Decision Summary Payload

- When Wave 35 contract is active, response adds:
  - `data.decision_summary`
    - `current_state` (`assigned|completed|cancelled|provider_missing`)
    - `latest_decision_label` (string)
    - `latest_decision_at` (ISO datetime or `null`)
    - `latest_actor` (string or `null`)
    - `evidence_count` (integer)
    - `has_evidence` (`true|false`)
    - `next_recommended_action` (nullable string)
- `decision_summary` is additive:
  - it must not replace `assignment`, `provider`, or `timeline`
  - it must be safe for clients that ignore the new node entirely

### Additive Timeline Metadata

- Each `data.timeline[]` event may now add:
  - `metadata.event_kind`
    - `assignment_created`
    - `provider_reassigned`
    - `assignment_completed`
    - `assignment_cancelled`
    - `evidence_uploaded`
  - `metadata.status_badge` (string)
  - `metadata.evidence_count` (integer, optional)
  - `metadata.provider_id` (integer, optional)
- Timeline ordering rules stay unchanged:
  - descending by `occurred_at`
  - deterministic for identical fixture data

### Guardrails and Error Semantics

- `401 TOKEN_EXPIRED`
  - one refresh attempt, then retry assignment detail once
- `401 TOKEN_INVALID|TOKEN_REVOKED`
  - clear session and route to `SessionExpired`
- `403 ROLE_SCOPE_FORBIDDEN`
  - authenticated but unauthorized users route to `Unauthorized`
- `404 QUEUE_ITEM_NOT_FOUND`
  - render deterministic missing-assignment state

### Compatibility Notes

- Wave 35 is additive over Waves 31, 32, 33, and 34:
  - no existing assignment detail fields are removed
  - action mutation flow stays unchanged
  - evidence upload/list contracts stay unchanged
  - new summary and timeline semantics are read-only enrichment for manager detail surfaces

## Wave 36 Manager Assignment Center Decision Rollup Contract

### Assignment Center Additive List Contract

- Endpoint:
  - `GET /api/properties/priorities/queue`
- Allowed roles:
  - `manager`
  - `admin`
- Baseline behavior:
  - existing assignment center filters, sorting, and pagination remain stable
  - existing queue item list nodes remain valid for current consumers

### Additive Decision Rollup Payload

- When Wave 36 contract is active, each provider-assignment queue item may add:
  - `data.items[].decision_rollup`
    - `current_state` (`unassigned|assigned|provider_missing|completed|cancelled`)
    - `latest_decision_label` (string)
    - `latest_decision_at` (ISO datetime or `null`)
    - `evidence_count` (integer)
    - `has_evidence` (`true|false`)
    - `status_badge` (string)
    - `next_recommended_action` (nullable string)
- `decision_rollup` is additive:
  - it must not replace queue item title, status, provider summary, or priority metadata
  - it must be safe for clients that ignore the node entirely
  - it is optional only when a queue item does not belong to the provider-assignment workflow

### List Rendering Semantics

- `decision_rollup.current_state` is the authoritative state source for assignment-center badge rendering.
- `decision_rollup.status_badge` is display-ready and must stay deterministic for identical fixture data.
- `decision_rollup.next_recommended_action` is advisory:
  - it does not grant new permissions
  - it does not replace authoritative actions available from assignment detail
- `decision_rollup.evidence_count` and `decision_rollup.has_evidence` are read-only rollups:
  - mobile must not infer them from local upload state alone

### Guardrails and Error Semantics

- `401 TOKEN_EXPIRED`
  - one refresh attempt, then retry assignment center list once
- `401 TOKEN_INVALID|TOKEN_REVOKED`
  - clear session and route to `SessionExpired`
- `403 ROLE_SCOPE_FORBIDDEN`
  - authenticated but unauthorized users route to `Unauthorized`
- `404 QUEUE_ITEM_NOT_FOUND`
  - handled only by detail flows; list contract remains stable and must not fail the whole collection read because a single item disappears

### Compatibility Notes

- Wave 36 is additive over Waves 31 through 35:
  - no list node removals
  - no filter or pagination contract changes
  - assignment detail remains the authoritative surface for full timeline history and evidence drill-down

## Wave 37 Manager Provider Directory Scorecard Contract

### Manager Provider Directory Query Contract

- Endpoint:
  - `GET /api/providers`
- Allowed roles:
  - `manager`
  - `admin`
- Query parameters:
  - `search` (free-text, optional)
  - `city` (optional)
  - `category` (optional)
  - `status` (optional)
  - `page` (optional integer)
  - `per_page` (optional integer)
- Baseline list behavior:
  - Wave 30 provider directory fields remain stable.
  - Existing consumers that only read `id`, `name`, `status`, `category`, `city`, and `rating` continue to work.

### Additive Directory Scorecard Preview

- Provider directory rows may add:
  - `data[].scorecard_preview`
    - `completed_jobs` (integer)
    - `customer_score` (number or formatted string)
    - `response_time_hours` (integer or `null`)
    - `availability_label` (string)
    - `coverage_count` (integer)
    - `services_count` (integer)
- `scorecard_preview` is additive:
  - it must not replace `availability_summary` or `services_preview[]`
  - it is safe for list rendering and lightweight provider comparison

### Manager Provider Profile Scorecard Detail

- Endpoint:
  - `GET /api/providers/{id}`
- Allowed roles:
  - `manager`
  - `admin`
- Baseline profile behavior:
  - Wave 30 provider profile contract remains stable.
  - Wave 34 `assignment_fit` remains optional and contextual when `queue_item_id` is supplied.
- Additive detail node:
  - `data.scorecard`
    - `completed_jobs`
    - `customer_score`
    - `response_time_hours`
    - `availability_label`
    - `coverage_count`
    - `services_count`
    - `status_badge`

### Navigation Consumption Rules

- Manager dashboard may expose a provider-directory CTA without requiring property context.
- Manager handoff flow may deep-link to provider profile while preserving the current property assignment context.
- Provider profile remains read-only:
  - no provider mutation CTA is introduced in Wave 37
  - assignment action entrypoints remain in manager handoff / assignment flows
- Directory filters and profile preview context must survive back-navigation from provider profile.

### Guardrails and Compatibility

- `401 TOKEN_EXPIRED`
  - one refresh attempt path, then retry list/detail once.
- `401 TOKEN_INVALID|TOKEN_REVOKED`
  - clear session and route to `SessionExpired`.
- `403 ROLE_SCOPE_FORBIDDEN`
  - keep authenticated state explicit and route to `Unauthorized`.
- `404 PROVIDER_NOT_FOUND`
  - deterministic missing-provider state for manager profile.

### Compatibility Notes

- Wave 37 is additive over Waves 30 and 34:
  - no endpoint removals
  - no breaking field removals
  - `assignment_fit` remains contextual and optional
  - `scorecard_preview` and `scorecard` are optional additive nodes for manager-native browsing surfaces
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

## Wave 38 Manager Provider Handoff Candidate Fit Contract

### Manager Provider Candidates Additive Fit Contract

- Endpoint:
  - `GET /api/properties/{id}/provider-candidates`
- Allowed roles:
  - `manager`
  - `admin`
- Baseline behavior:
  - Wave 29 handoff candidate list fields remain stable.
  - Existing consumers that only read candidate identity, category, city, rating, and availability continue to work.

### Additive Candidate Fit Preview

- Each candidate row may add:
  - `data[].fit_preview`
    - `score_label` (string)
    - `recommendation_badge` (`recommended|consider|warning|not_recommended`)
    - `match_reasons[]` (string array)
    - `warnings[]` (string array)
    - `next_action_hint` (nullable string)
- `fit_preview` is additive:
  - it must not replace baseline candidate identity, availability, or pricing fields
  - it must be safe for clients that ignore the new node entirely

### Queue-Aware Selection State

- Each candidate row may add:
  - `data[].selection_state`
    - `queue_status` (`ready|confirmation_required|already_selected|already_assigned|blocked`)
    - `can_select` (`true|false`)
    - `blocked_reason` (nullable string)
    - `confirmation_copy`
      - `title` (nullable string)
      - `body` (nullable string)
      - `confirm_label` (nullable string)
- Selection-state semantics are authoritative from backend:
  - mobile must not infer confirmation requirements from raw profile data alone
  - `already_selected` and `already_assigned` suppress duplicate mutation affordances

### Guardrails and Error Semantics

- `401 TOKEN_EXPIRED`
  - one refresh attempt, then retry provider-candidates once
- `401 TOKEN_INVALID|TOKEN_REVOKED`
  - clear session and route to `SessionExpired`
- `403 ROLE_SCOPE_FORBIDDEN`
  - authenticated but unauthorized users route to `Unauthorized`
- `404 PROPERTY_NOT_FOUND`
  - deterministic missing-property recovery state for manager handoff

### Compatibility Notes

- Wave 38 is additive over Waves 29, 34, and 37:
  - no endpoint removals
  - no baseline candidate field removals
  - provider profile scorecard remains the authoritative deep-read surface
  - handoff candidate fit preview is a lighter comparison contract for manager assignment workflows

