# Provider List API v1

## Endpoint

`GET /api/v1/providers`

## Purpose

Returns a paginated list of service providers available in the CRM ecosystem, with filters and sorting for client apps.

## Authentication

Bearer token is required.

Header:

`Authorization: Bearer {token}`

Expected auth context:

- `role`: `admin`, `real_estate_manager`, or `service_provider`.
- Tenant/organization scoping must be enforced server-side.

## Query Parameters

| Name | Type | Description | Required | Default |
|------|------|-------------|----------|---------|
| search | string | Full-text match against provider name and description | No | - |
| category | string | Category slug/code filter | No | - |
| city | string | Provider city filter | No | - |
| min_rating | number | Minimum average rating (1.0-5.0) | No | - |
| page | integer | 1-based page index | No | 1 |
| per_page | integer | Page size (max 100) | No | 20 |
| sort | string | Sort field: `name`, `rating`, `created_at` | No | `created_at` |
| order | string | Sort direction: `asc`, `desc` | No | `desc` |

Validation rules:

- `page >= 1`
- `1 <= per_page <= 100`
- `1.0 <= min_rating <= 5.0`
- `sort` and `order` must be in allowlists

## Success Response (200)

JSON shape:

```json
{
  "data": [
    {
      "id": 1024,
      "name": "CleanHome Pro",
      "category": "cleaning",
      "city": "Madrid",
      "rating": 4.8,
      "services_count": 12,
      "active": true,
      "created_at": "2026-03-01T10:40:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 245,
    "total_pages": 13
  }
}
```

## Error Model

All errors return:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | `BAD_REQUEST` | Invalid generic query format |
| 401 | `UNAUTHENTICATED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Authenticated but no access to resource scope |
| 422 | `VALIDATION_ERROR` | Field-level validation failed |
| 500 | `INTERNAL_ERROR` | Unexpected server-side failure |

## Laravel Implementation Notes

- Route: `GET /api/v1/providers` in `routes/api.php` behind auth middleware.
- Controller: `ProviderController@index` only maps request/response and delegates business logic.
- Service: `ProviderService::listProviders(array $filters)` builds query, applies scopes/filters/sorting, returns paginator.
- Request validation: `ListProvidersRequest` validates query params and converts to normalized DTO/filter array.
- Resource layer: `ProviderResource` + `ProviderCollection` to keep API shape stable.
- Backward compatibility: do not remove existing fields; only add nullable fields in v1.

