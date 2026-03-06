# Native Mobile Release Notes v0.1.0

Release date: 2026-03-06

## Scope

This release candidate establishes the initial native-app baseline for the CRM ecosystem:

- Manager app (React Native + TypeScript)
- Providers app (React Native + TypeScript)
- API contracts for property/provider list and detail flows
- Local orchestration workflow with Jira traceability and controlled merges

## Included Features

### Manager app

- Dashboard scaffold with KPI cards and operational priorities
- Property portfolio list with search
- Property detail view
- API integration for `/api/properties` and `/api/properties/{id}`
- Environment/session bootstrap:
  - `EXPO_PUBLIC_API_URL`
  - `EXPO_PUBLIC_MOBILE_API_TOKEN`
  - `EXPO_PUBLIC_APP_STAGE`
  - `EXPO_PUBLIC_SHOW_ENV_DIAGNOSTICS`
  - `EXPO_PUBLIC_API_TIMEOUT_MS`

### Providers app

- Provider list with search and status indicators
- Provider detail view
- API integration for `/api/providers` and `/api/providers/{id}`
- Environment/session bootstrap with same contract as manager app

### Backend API

- Provider endpoints:
  - `GET /api/providers`
  - `GET /api/providers/{id}`
- Property endpoints:
  - `GET /api/properties`
  - `GET /api/properties/{id}`
- Access gate supports:
  - Authenticated CRM users
  - Bearer token clients via `KC_MOBILE_API_TOKEN`
- Bearer parser regression fix:
  - Accepts case-insensitive scheme (`Bearer`, `bearer`)

## QA and Validation

- API smoke coverage for list/detail flows (providers and properties)
- Functional mobile API flow suite:
  - Provider list -> detail
  - Property list -> detail
- Regression checks:
  - Invalid/empty token remains unauthorized
  - Lowercase bearer scheme accepted
- CI checks passed for all merged PR waves in this release cycle

## Known Constraints

- Backend data currently uses in-memory service datasets (not DB persistence yet)
- Mobile auth is bootstrap token-based for release candidate; full auth/session lifecycle is pending hardening

## Next Release Focus (v0.2.0)

- DB-backed repositories aligned with CRM schema
- Full authentication flow (login/refresh/logout)
- Expanded business actions (create/update/reserve/assignment)
- Production hardening for token/security and role scopes
