# API Boundary

## Versioning Rule

- Public contracts are exposed under `/api/v1/*`.
- New fields are additive in `v1`; breaking changes require `v2`.
- Transitional endpoints may exist under `/api/*` while legacy CRM modules are aligned to `v1`.

## Property Domain (Manager App)

- `GET /api/v1/properties`
- `GET /api/v1/properties/{id}`
- `POST /api/v1/properties`
- `PATCH /api/v1/properties/{id}`
- `DELETE /api/v1/properties/{id}`

Ownership:

- Primary owner: `real_estate_manager` app flow.
- Secondary consumers: admin reporting.

## Service Provider Domain (Provider App)

- `GET /api/v1/providers`
- `GET /api/v1/providers/{id}`
- `GET /api/v1/providers/{id}/services`
- `PATCH /api/v1/providers/{id}/availability`

Ownership:

- Primary owner: `home_service_provider` app flow.
- Secondary consumers: manager app for assignment/selection.

## Auth Domain (Shared)

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

Ownership:

- Primary owner: backend auth/session module.
- Consumers: manager app, provider app, admin backoffice (as required).

## Admin Domain (Backoffice Surface)

- `GET /api/v1/admin/users`
- `GET /api/v1/admin/audit-log`
- `GET /api/v1/admin/kpis`
- `PATCH /api/v1/admin/users/{id}/status`

Ownership:

- Primary owner: operations/admin team.
- Admin endpoints are not exposed directly in consumer mobile apps.

## Auth and Scope Boundary

- All endpoints require one of:
  - Authenticated CRM session cookie (web/admin flows).
  - Mobile bearer token (bootstrap mode).
  - Access token from `/api/v1/auth/login` (target mode).
- Tenant or organization scope is enforced server-side.
- Mobile bearer token contract:
  - Request header: `Authorization: Bearer <token>`
  - Server expected token: `KC_MOBILE_API_TOKEN`
  - Mobile config source: `EXPO_PUBLIC_MOBILE_API_TOKEN`
- Session token contract:
  - Token expiry failures return `401` with code `TOKEN_EXPIRED`.
  - Invalid/revoked tokens return `401` with code `TOKEN_INVALID` or `TOKEN_REVOKED`.
  - Clients should attempt a single refresh via `POST /api/v1/auth/refresh`.
- Role checks:
  - manager endpoints -> manager/admin
  - provider endpoints -> provider/admin
  - admin endpoints -> admin only
- Scope mismatch must return `403`.
