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

## Wave 12 Cross-App Handoffs

| Source app | Source screen | Trigger | Target app | Target screen | Required payload |
| --- | --- | --- | --- | --- | --- |
| manager-app | ProviderLookup | Open provider workspace | provider-app | ProviderDashboard | `providerId`, `handoffToken`, `origin=manager` |
| manager-app | PropertyDetail | Assign provider | provider-app | AssignedRequests | `propertyId`, `providerId`, `handoffToken` |
| provider-app | AssignedRequests | Open property context | manager-app | PropertyDetail | `propertyId`, `handoffToken`, `origin=provider` |
| provider-app | ProviderDashboard | Escalate to manager workflow | manager-app | ManagerHome | `providerId`, `handoffToken` |

### Handoff State Rules

- `handoff_pending`
  - Validate deep-link payload schema before navigation.
  - Reject navigation if required ids are missing.
- `handoff_authorized`
  - Validate `handoffToken` server-side before rendering target screen.
  - Hydrate target screen only after role and scope checks.
- `handoff_rejected`
  - Route to `Unauthorized` and preserve source context for retry.
  - Log rejection with reason code (`ROLE_MISMATCH`, `INVALID_CONTEXT`, `TOKEN_INVALID`).

### Role Boundary Outcomes

- Manager opening provider-only edit surfaces:
  - Allowed: read dashboards, assignment context.
  - Blocked: direct provider availability mutation.
- Provider opening manager-only property mutation surfaces:
  - Allowed: read assignment-bound property detail.
  - Blocked: manager-level property CRUD actions.

## Contract Mapping

- Auth routes: `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`.
- Manager data routes: `/api/properties*`, `/api/providers*`.
- Provider data routes: `/api/providers/{id}*`.
- Handoff validation routes:
  - `POST /api/auth/handoff/validate`
  - `POST /api/auth/handoff/exchange`
- Role boundary enforcement routes:
  - `GET /api/providers/{id}` with manager scope guard.
  - `GET /api/properties/{id}` with provider assignment guard.

## Delivery Sequencing (Wave 11)

1. Architecture docs and navigation contract (`ARCH-007`).
2. Manager auth/session UI shell (`MOB-008`).
3. Provider dashboard shell (`MOB-009`).
4. Auth error contract normalization (`BE-009`).
5. QA regression alignment (`QA-010`).

## Wave 12 Delivery Sequencing

1. Cross-app navigation and handoff contract (`ARCH-008`).
2. Backend role boundary hardening (`BE-010`).
3. Manager/provider handoff UI states (`MOB-009`).
4. Wave 12 regression matrix (`QA-011`).

## Wave 13 Provider Availability Editor

### Provider Availability States

- `availability_view`
  - Show current weekly slots.
  - Source: `GET /api/providers/{id}/availability`.
- `availability_edit`
  - User updates day ranges, start/end time, and active flag.
  - Local form validation runs before submission.
- `availability_saving`
  - Disable duplicate submit.
  - Persist via `PATCH /api/providers/{id}/availability`.
- `availability_saved`
  - Confirm save success and refresh visible schedule.
- `availability_error`
  - Keep unsaved draft and show retry action.
- `availability_forbidden`
  - Surface deterministic `403 ROLE_SCOPE_FORBIDDEN`.
  - Keep session alive and route back to provider dashboard context.

### Wave 13 Availability Role Boundaries

- `provider` and `admin`:
  - Read and mutate availability for provider workspace.
- `manager`:
  - Read-only access to provider availability.
  - Any mutation attempt must return `403 ROLE_SCOPE_FORBIDDEN`.

### Wave 13 Delivery Sequencing

1. Availability contract and UX map (`ARCH-009`).
2. Availability API + role guards (`BE-011`).
3. Provider availability editor screen integration (`MOB-010`).
4. Availability regression matrix (`QA-012`).
