# Module Map

## App Surfaces

- `manager-app` (React Native): properties, manager dashboard, provider discovery.
- `provider-app` (React Native): provider self-profile, availability, assigned requests.
- `admin-surface` (web/backoffice): full CRUD across domains, audit, support workflows.

## Backend Modules


### Property Module

- Responsibilities:
  - Property listing and lifecycle state.
  - Ownership and manager assignment.
  - Property metrics feeding manager dashboards.
  - Manager portfolio summary and filter contract for native app parity.
  - Manager property mutation contract for reserve, release, and status update actions.
- Main contracts:
  - `/api/properties*`
  - `/api/properties/summary`
  - `/api/properties/{id}/reserve`
  - `/api/properties/{id}/release`
  - `/api/properties/{id}` (`PATCH` status mutation)

### Provider Module

- Responsibilities:
  - Provider profile and status for self-service flows.
  - Availability and service coverage by city/category.
  - Weekly availability slot orchestration for provider workflows.
  - Identity-bound availability writes for provider self-scope.
  - Provider quality indicators (rating, active status).
- Main contracts:
  - `/api/providers/{id}` (self/admin reads)
  - `/api/providers/{id}/availability` (read and mutate with role guard)

### Admin Module

- Responsibilities:
  - User status and role management.
  - Cross-domain observability and audit access.
  - Operational overrides and incident support.
- Main contracts:
  - `/api/admin*`

### Auth Session Module

- Responsibilities:
  - Login, refresh, logout lifecycle orchestration.
  - Token issuance/revocation and role-scope validation.
  - Session compatibility between CRM web and native apps.
- Main contracts:
  - `/api/auth/login`
  - `/api/auth/refresh`
  - `/api/auth/logout`

## Cross-Cutting Modules

- Auth and roles.
- Tenant/organization scoping.
- Logging/audit events.
- Notification dispatch.

## Surface to Module Mapping

- `manager-app` -> Property Module + Auth Session Module.
- `provider-app` -> Provider Module + Auth Session Module.
- `admin-surface` -> Admin Module + Auth Session Module.

## Wave 12 Cross-App Boundaries

### Handoff Contract Module

- Responsibilities:
  - Validate cross-app navigation payloads (`providerId`, `propertyId`, `handoffToken`).
  - Exchange short-lived handoff token for role-scoped access context.
  - Emit audit events for accepted/rejected handoffs.
- Main contracts:
  - `POST /api/auth/handoff/validate`
  - `POST /api/auth/handoff/exchange`

### Role Boundary Guard Layer

- Responsibilities:
  - Enforce manager/provider read-write boundaries at endpoint level.
  - Normalize forbidden responses to deterministic error codes for mobile clients.
  - Validate provider ownership for provider-role availability writes.
- Main contracts:
  - Manager accessing provider scope: `GET /api/providers/{id}` (read-only allowed).
  - Manager accessing provider availability mutation: `PATCH /api/providers/{id}/availability` -> `403 ROLE_SCOPE_FORBIDDEN`.
  - Provider accessing manager scope: `GET /api/properties/{id}` (assignment-bound only).
  - Provider accessing another provider availability mutation: `PATCH /api/providers/{id}/availability` -> `403 PROVIDER_IDENTITY_MISMATCH`.
  - Forbidden mutation guard: `403 ROLE_SCOPE_FORBIDDEN`.

## Wave 14 Provider Identity Boundary

### Provider Identity Resolver

- Responsibilities:
  - Resolve authenticated provider identity from session/token claims.
  - Bind provider-role write actions to resolved identity instead of client-provided ids.
- Contract notes:
  - `provider` role can mutate only `provider_id == session.provider_id`.
  - `admin` can operate across provider identities with explicit audit trail.
  - API shape remains additive/backward-compatible with Wave 13 contracts.

### Ownership Notes

- Auth Session Module owns token and handoff lifecycle rules.
- Property Module owns manager-side domain authorization checks.
- Provider Module owns provider-side domain authorization checks.
- Admin Module is not part of mobile cross-app handoff flows.

## Wave 15 Availability Concurrency Boundary

### Availability Revision Guard Layer

- Responsibilities:
  - Enforce optimistic concurrency for provider availability mutations.
  - Compare client `revision` token against latest persisted revision.
  - Reject stale writes with deterministic `409 AVAILABILITY_REVISION_CONFLICT`.
- Main contracts:
  - `GET /api/providers/{id}/availability` -> includes additive `data.revision`.
  - `PATCH /api/providers/{id}/availability` -> requires `revision` from client.
  - Conflict payload includes stable `error.code`, `meta.reason`, and reload context.

### Ownership with Concurrency Notes

- Wave 14 ownership guard still executes before mutation:
  - Provider identity mismatch remains `403 PROVIDER_IDENTITY_MISMATCH`.
- Only authorized + ownership-valid requests reach revision conflict checks.
- Admin override remains allowed across provider ids but still respects revision checks.

## Wave 16 Manager Portfolio Boundary

### Manager Portfolio Contract Layer

- Responsibilities:
  - Serve deterministic manager KPI summary payload for dashboard.
  - Serve property list data with normalized filter and pagination metadata.
  - Preserve backward compatibility with existing property list consumers.
- Main contracts:
  - `GET /api/properties/summary`
  - `GET /api/properties?status=&city=&search=&page=&per_page=`
- Error semantics:
  - `401 TOKEN_EXPIRED` / `TOKEN_INVALID` handled by Auth Session Module.
  - `403 ROLE_SCOPE_FORBIDDEN` for non-manager/non-admin access.
  - Validation errors return deterministic envelope for filter parameters.

## Wave 17 Manager Property Mutation Boundary

### Manager Mutation Guard Layer

- Responsibilities:
  - Enforce manager/admin role scope on property mutation endpoints.
  - Normalize conflict and validation outcomes for mobile consumers.
  - Guarantee deterministic response envelopes for reserve/release/status transitions.
- Main contracts:
  - `POST /api/properties/{id}/reserve`
  - `POST /api/properties/{id}/release`
  - `PATCH /api/properties/{id}`
- Error semantics:
  - `403 ROLE_SCOPE_FORBIDDEN` for unauthorized roles.
  - `409 PROPERTY_STATE_CONFLICT` for stale or invalid state transitions.
  - `422 VALIDATION_ERROR` for malformed mutation payloads.

## Wave 18 Manager Property Form Boundary

### Manager Property Form Contract Layer

- Responsibilities:
  - Expose manager-scoped create/edit property operations for native forms.
  - Keep Wave 17 mutation compatibility while extending editable fields.
  - Return deterministic field-level validation feedback for mobile UI mapping.
- Main contracts:
  - `POST /api/properties` (create)
  - `PATCH /api/properties/{id}` (edit + status mutation compatibility)
- Error semantics:
  - `422 VALIDATION_ERROR` with `error.fields` map.
  - `403 ROLE_SCOPE_FORBIDDEN` for role violations.
  - `404 PROPERTY_NOT_FOUND` for edit on missing ids.

### Auth Refresh Coordination Layer (Manager App)

- Responsibilities:
  - Centralize refresh ownership to prevent duplicate refresh requests.
  - Guarantee one retry boundary after token refresh.
  - Trigger deterministic session teardown when refresh is not recoverable.
- Main contracts:
  - `POST /api/auth/refresh` (singleflight consumer path)
  - `POST /api/auth/logout` (terminal cleanup path)
- UX mapping dependencies:
  - `SessionExpired` for hard auth failures.
  - Property form screens consume validation and auth boundary outcomes without silent fallbacks.

## Wave 19 Manager Provider Handoff Boundary

### Manager Handoff Contract Layer

- Responsibilities:
  - Provide provider candidates for a selected property context.
  - Assign provider to property with deterministic validation/conflict semantics.
  - Preserve Wave 16-18 manager compatibility while extending operational flow.
- Main contracts:
  - `GET /api/properties/{id}/provider-candidates`
  - `POST /api/properties/{id}/assign-provider`
- Error semantics:
  - `422 VALIDATION_ERROR` for malformed assignment payload.
  - `404 PROPERTY_NOT_FOUND` / `PROVIDER_NOT_FOUND`.
  - `409 ASSIGNMENT_CONFLICT` for stale/incompatible assignment state.
  - `403 ROLE_SCOPE_FORBIDDEN` for provider/unknown roles.

### Provider Candidate Resolution Layer

- Responsibilities:
  - Resolve candidate providers from provider module data source with deterministic filters.
  - Keep source metadata explicit (`database` or `in_memory`) for diagnostics.
- Ownership notes:
- Candidate discovery is manager/admin read scope only.
- Provider role remains restricted from manager assignment surfaces.

## Wave 20 Manager Session Introspection Boundary

### Auth Session Introspection Layer

- Responsibilities:
  - Expose session identity and role/scope claims for persisted token validation.
  - Keep auth/session envelope parity across login/refresh/logout/introspection routes.
- Main contracts:
  - `GET /api/auth/me`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
- Error semantics:
  - `401 TOKEN_EXPIRED` (refresh path)
  - `401 TOKEN_INVALID|TOKEN_REVOKED` (hard reset path)
  - `403 ROLE_SCOPE_FORBIDDEN` for non-manager scopes in manager runtime

### Manager App Bootstrap Layer

- Responsibilities:
  - Resolve startup route based on persisted token + `auth/me` validation.
  - Prevent dashboard mount until role/scope is validated.
  - Preserve deterministic transition to `Login`, `Unauthorized`, or `SessionExpired`.
- Ownership notes:
  - Session module owns token lifecycle.
  - Manager module consumes validated session context only.

## Wave 21 Manager Assignment Context Boundary

### Assignment Context Composition Layer

- Responsibilities:
  - Compose current property assignment metadata with provider snapshot details for manager detail surfaces.
  - Preserve deterministic state when provider reference exists but provider profile is missing.
  - Keep Wave 19 provider assignment contracts unchanged while adding read-context parity.
- Main contracts:
  - `GET /api/properties/{id}/assignment-context`
  - Existing dependencies:
    - `GET /api/properties/{id}`
    - `GET /api/properties/{id}/provider-candidates`
    - `POST /api/properties/{id}/assign-provider`
- Error semantics:
  - `401` with `auth-session-v1` envelope.
  - `403 ROLE_SCOPE_FORBIDDEN` for non-manager/non-admin.
  - `404 PROPERTY_NOT_FOUND` with `manager-provider-context-v1` contract metadata.

### Ownership Notes

- Property module owns assignment state (`provider_id`, `assigned_at`, `handoff_note`).
- Provider module owns provider profile snapshot fields (`name`, `category`, `city`, `status`, `rating`).
- Manager UI consumes merged payload only, never direct multi-endpoint stitching in presentation layer.

## Compatibility Rules

- Existing CRM contracts remain valid while native apps are onboarded.
- Mobile clients depend only on public API contracts, never direct DB access.
- Module internals can evolve as long as `v1` response contracts remain backward compatible.
