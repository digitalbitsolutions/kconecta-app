# Module Map

## App Surfaces

- `manager-app` (React Native): properties, manager dashboard, provider discovery.
- `provider-app` (React Native): service provider profile, availability, assigned requests.
- `admin-surface` (web/backoffice): full CRUD across domains, audit, support workflows.

## Backend Modules

### Property Module

- Responsibilities:
  - Property listing and lifecycle state.
  - Ownership and manager assignment.
  - Property metrics feeding manager dashboards.
- Main contracts:
  - `/api/properties*`

### Provider Module

- Responsibilities:
  - Provider catalog and filtering.
  - Availability and service coverage by city/category.
  - Weekly availability slot orchestration for provider workflows.
  - Identity-bound availability writes for provider self-scope.
  - Provider quality indicators (rating, active status).
- Main contracts:
  - `/api/providers*`
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

## Compatibility Rules

- Existing CRM contracts remain valid while native apps are onboarded.
- Mobile clients depend only on public API contracts, never direct DB access.
- Module internals can evolve as long as `v1` response contracts remain backward compatible.
