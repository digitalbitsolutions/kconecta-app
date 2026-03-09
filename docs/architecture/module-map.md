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
- Main contracts:
  - `/api/properties*`
  - `/api/properties/summary`

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

## Compatibility Rules

- Existing CRM contracts remain valid while native apps are onboarded.
- Mobile clients depend only on public API contracts, never direct DB access.
- Module internals can evolve as long as `v1` response contracts remain backward compatible.
