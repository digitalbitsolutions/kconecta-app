# API Boundary

## Versioning Rule

- Public contracts are exposed under `/api/v1/*`.
- New fields are additive in `v1`; breaking changes require `v2`.

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

## Admin Domain (Backoffice Surface)

- `GET /api/v1/admin/users`
- `GET /api/v1/admin/audit-log`
- `GET /api/v1/admin/kpis`
- `PATCH /api/v1/admin/users/{id}/status`

Ownership:

- Primary owner: operations/admin team.
- Admin endpoints are not exposed directly in consumer mobile apps.

## Auth and Scope Boundary

- All endpoints require authenticated sessions/tokens.
- Tenant or organization scope is enforced server-side.
- Role checks:
  - manager endpoints -> manager/admin
  - provider endpoints -> provider/admin
  - admin endpoints -> admin only
