# UI/UX Map (Wave 11)

## Objective

Define the first production-shaped mobile information architecture for manager and provider apps, aligned with Wave 10 auth/session contracts.

## App Shells

- `manager-app`
  - Focus: property operations, provider lookup, manager overview.
- `provider-app`
  - Focus: provider status, availability, assigned work.

## Navigation Map

### Manager App

1. `AuthStack`
2. `ManagerHome`
3. `PropertiesList`
4. `PropertyDetail`
5. `ProviderLookup`
6. `SessionExpired`

### Provider App

1. `AuthStack`
2. `ProviderDashboard`
3. `AvailabilityEditor`
4. `AssignedRequests`
5. `ProfileSettings`
6. `SessionExpired`

## Screen Taxonomy

| Surface | Screen | Type | Data dependency |
| --- | --- | --- | --- |
| Manager | AuthStack | Entry/Auth | `POST /api/auth/login` |
| Manager | ManagerHome | Dashboard | `/api/properties`, `/api/providers` |
| Manager | PropertiesList | List | `GET /api/properties` |
| Manager | PropertyDetail | Detail | `GET /api/properties/{id}` |
| Manager | ProviderLookup | Search/List | `GET /api/providers` |
| Provider | AuthStack | Entry/Auth | `POST /api/auth/login` |
| Provider | ProviderDashboard | Dashboard | `GET /api/providers/{id}` |
| Provider | AvailabilityEditor | Form | `PATCH /api/providers/{id}/availability` |
| Provider | AssignedRequests | List | provider assignment endpoint |
| Provider | ProfileSettings | Settings | profile endpoint |

## Session State UX Rules

- `unauthenticated`
  - Route to `AuthStack`.
  - Hide domain screens from navigation state.
- `authenticated`
  - Route to role home screen (`ManagerHome` or `ProviderDashboard`).
  - Keep token only in session store abstraction.
- `refreshing`
  - Block duplicate request retries.
  - Keep current screen visible with non-blocking loading indicator.
- `expired`
  - Route to `SessionExpired`.
  - Show deterministic CTA: `Re-authenticate`.
- `terminated`
  - Clear session store and navigation history.
  - Return to `AuthStack` root.

## Unauthorized and Expired Handling

- `401 TOKEN_EXPIRED`
  - Attempt one refresh.
  - On failure, transition to `expired`.
- `401 TOKEN_INVALID` or `TOKEN_REVOKED`
  - Transition directly to `terminated`.
- `403` (scope mismatch)
  - Keep user authenticated.
  - Show "insufficient permissions" state on current screen.

## Contract Mapping

- Auth routes: `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`.
- Manager data routes: `/api/properties*`, `/api/providers*`.
- Provider data routes: `/api/providers/{id}*`.

## Delivery Sequencing (Wave 11)

1. Architecture docs and navigation contract (`ARCH-007`).
2. Manager auth/session UI shell (`MOB-008`).
3. Provider dashboard shell (`MOB-009`).
4. Auth error contract normalization (`BE-009`).
5. QA regression alignment (`QA-010`).
