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
   - Provider quality indicators (rating, active status).
- Main contracts:
   - `/api/providers*`

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

- `manager-app` ➔ Property Module + Auth Session Module.
- `provider-app` ➔ Provider Module + Auth Session Module.
- `admin-surface` ➔ Admin Module + Auth Session Module.

## Compatibility Rules

- Existing CRM contracts remain valid while native apps are onboarded.
- Mobile clients depend only on public API contracts, never direct DB access.
- Module internals can evolve as long as `v1` response contracts remain backward compatible.
