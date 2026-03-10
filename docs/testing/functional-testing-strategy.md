# Functional Testing Strategy

## Purpose

Validate end-to-end functional behavior of native app API contracts before release promotion.

## Scope

- Manager app flows:
  - Properties list retrieval
  - Property detail retrieval
  - Auth behavior for valid/invalid bearer token
- Providers app flows:
  - Providers list retrieval
  - Provider detail retrieval
  - Auth behavior for valid/invalid bearer token
- Auth flow:
  - Login
  - Refresh
  - Logout
  - Token expired
  - Invalid token

## Critical Flow Matrix

1. Provider mobile flow: `/api/providers` -> `/api/providers/{id}`
2. Manager mobile flow: `/api/properties` -> `/api/properties/{id}`
3. Auth control flow: invalid token -> `401` for provider/property list endpoints
4. Auth parser regression: lowercase `bearer` scheme remains accepted
5. Mobile timeout regression: client timeout value stays configurable via env and documented in release notes
6. Data-source contract: list endpoints expose `meta.source` as `database` or `in_memory`
7. Auth flow regression: login, refresh, logout, token-expired, invalid-token scenarios

## Auth Regression Checklist

1. `/api/auth/login` returns contract payload for valid credentials.
2. `/api/auth/login` returns `401` with `INVALID_CREDENTIALS` for invalid credentials.
3. `/api/auth/refresh` returns `401` with token error code when bearer token is missing/invalid.
4. `/api/auth/refresh` returns rotated token payload for valid bearer token.
5. `/api/auth/logout` returns `401` when bearer token is missing/invalid.
6. `/api/auth/logout` returns revoked payload for valid bearer token.

## Wave 11 UI/Auth Smoke Matrix

1. Manager auth shell (`DEV-52`)
  - `Login` route is reachable and can bootstrap runtime token.
  - `Unauthorized` route can reset session and return to `Login`.
  - `SessionExpired` route offers deterministic re-authentication path.
2. Provider auth-aware shell (`DEV-53`)
  - `ProviderDashboard` route is default when session token exists.
  - `ProviderUnauthorized` route is triggered on unauthorized reset hook.
  - `AvailabilityShell` route is reachable from dashboard.
3. Backend auth contract (`DEV-51`)
  - Unauthorized auth routes expose stable payload shape:
    - `error.code`
    - `meta.contract`, `meta.mode`, `meta.flow`, `meta.reason`, `meta.retryable`

## Wave 11 Ticket Mapping

1. `DEV-51` -> API contract assertions in `tests/Feature/Api/AuthSessionApiTest.php`.
2. `DEV-52` -> Manager auth navigation smoke paths in QA checklist.
3. `DEV-53` -> Provider dashboard/availability/auth fallback smoke paths in QA checklist.
4. `DEV-54` -> QA coordination item ensuring the matrix above remains regression-safe.

## Wave 12 Role Boundary and Handoff Matrix

1. Role boundary hardening (`DEV-59`, `DEV-60`)
  - Provider role + mobile token -> `/api/providers` stays reachable.
  - Provider role + mobile token -> `/api/properties` must return `403` + `ROLE_SCOPE_FORBIDDEN` when role guard is enabled.
  - Manager role + mobile token -> `/api/properties` stays reachable.
  - Manager role + mobile token -> `/api/providers` must return `403` + `ROLE_SCOPE_FORBIDDEN` when role guard is enabled.
2. Unauthorized + session-expired flows
  - Missing/invalid token on protected API routes returns `401`.
  - Expired token on `/api/auth/refresh` and `/api/auth/logout` returns `401` with stable auth-session contract metadata.
3. Cross-app handoff validation
  - `/api/auth/login` returns deterministic `data.role` and `data.scope`.
  - Role/scope payload is the contract source for manager/provider shell routing in native apps.

## Wave 12 Ticket Mapping

1. `DEV-58` -> Cross-app navigation and handoff contract documented in architecture artifacts.
2. `DEV-59` -> Backend role-boundary enforcement with deterministic `403` payload.
3. `DEV-60` -> Native manager/provider handoff UI states and mismatch handling.
4. `DEV-61` -> Regression matrix + API tests in `tests/Feature/Api/Wave12RegressionMatrixTest.php`.

## Wave 13 Provider Availability Matrix

1. Availability read flow (`DEV-65`, `DEV-66`)
  - Provider app reads `/api/providers/{id}/availability` with provider role context.
  - Response must expose `meta.contract=provider-availability-v1`.
  - Payload includes `timezone` and normalized `slots[]`.
2. Availability update flow (`DEV-65`, `DEV-66`)
  - Provider role can patch `/api/providers/{id}/availability`.
  - Manager role must receive `403 ROLE_SCOPE_FORBIDDEN`.
  - Invalid slot payload must return deterministic `422 VALIDATION_FAILED`.
3. Session and security validation (`DEV-67`)
  - Missing/invalid bearer token on availability routes must return `401`.
  - Unknown provider ids must return `404` with provider context payload.

## Wave 13 Ticket Mapping

1. `DEV-64` -> Architecture contract/state map for availability editor.
2. `DEV-65` -> Backend availability endpoints and role guard.
3. `DEV-66` -> Provider app availability editor + API integration.
4. `DEV-67` -> Regression matrix + API checks in `tests/Feature/Api/Wave13RegressionMatrixTest.php`.

## Wave 14 Provider Identity Matrix

1. Provider self-scope enforcement (`DEV-72`, `DEV-73`)
  - Provider role read/update requires resolved provider identity in session context.
  - Provider editing another provider availability must return `403 PROVIDER_IDENTITY_MISMATCH`.
  - Provider requests without identity header/claim must return `403 PROVIDER_IDENTITY_MISMATCH`.
2. Admin override path (`DEV-72`)
  - Admin role can update cross-provider availability with stable `provider-availability-v1` contract.
3. Mobile UX recovery states (`DEV-73`)
  - `401 TOKEN_INVALID/TOKEN_EXPIRED` -> session recovery path.
  - `403 PROVIDER_IDENTITY_MISMATCH` -> ownership mismatch read-only state + dashboard CTA.
  - `403 ROLE_SCOPE_FORBIDDEN` -> authenticated read-only fallback.

## Wave 14 Ticket Mapping

1. `DEV-70` -> Provider identity ownership contract and UX state map.
2. `DEV-72` -> Backend identity resolver and availability ownership guard.
3. `DEV-73` -> Provider app identity-driven availability editor flow.
4. `DEV-71` -> Regression matrix updates in `tests/Feature/Api/ProviderAvailabilityApiTest.php` and `tests/Feature/Api/Wave13RegressionMatrixTest.php`.

## Wave 15 Availability Concurrency Matrix

1. Revision token flow (`DEV-77`, `DEV-76`)
  - Availability read exposes current `revision`.
  - Availability update includes `revision` in request payload.
2. Stale write conflict guard (`DEV-77`)
  - Stale `revision` update returns `409 AVAILABILITY_REVISION_CONFLICT`.
  - Conflict payload includes deterministic `meta.contract`, `meta.reason`, and flow context.
3. Mobile conflict recovery (`DEV-76`)
  - Provider editor renders stale-data state.
  - UI exposes deterministic `Reload Availability` recovery action.
4. Baseline protection (`DEV-78`)
  - Wave 14 ownership checks remain stable while Wave 15 conflict handling is introduced.

## Wave 15 Ticket Mapping

1. `DEV-75` -> Revision/conflict architecture contract.
2. `DEV-77` -> Backend optimistic concurrency guard implementation.
3. `DEV-76` -> Mobile conflict UX and revision-aware save flow.
4. `DEV-78` -> Regression matrix and API assertions for Wave 15.

## Wave 16 Manager Parity Matrix

1. Manager auth/session parity (`DEV-80`, `DEV-83`)
  - `/api/auth/login` returns manager role + deterministic scope for manager app.
  - Invalid/expired auth contexts keep returning stable `auth-session-v1` envelope.
2. Manager portfolio parity (`DEV-81`, `DEV-82`, `DEV-83`)
  - `/api/properties` returns pagination metadata (`page`, `per_page`, `total`) and KPI block for dashboard consumption.
  - Property list accepts contract filters (`status`, `city`, `manager_id`, `search`) with deterministic meta echo.
  - Invalid pagination returns deterministic `422` validation envelope.
3. Cross-wave safety baseline (`DEV-83`)
  - Wave 14 provider ownership guard remains active (`PROVIDER_IDENTITY_MISMATCH` path).
  - Wave 15 availability revision conflict remains active (`AVAILABILITY_REVISION_CONFLICT` path).

## Wave 16 Ticket Mapping

1. `DEV-79` -> Wave 16 orchestration epic and rollout tracking.
2. `DEV-80` -> Manager auth/session + portfolio architecture contract.
3. `DEV-81` -> Backend manager portfolio summary/filter contract implementation.
4. `DEV-82` -> Mobile manager dashboard/property screens wired to real API data.
5. `DEV-83` -> Regression matrix + API assertions in `tests/Feature/Api/Wave16RegressionMatrixTest.php`.

## Execution Checklist

1. Ensure Docker services are up and API endpoint is reachable.
2. Confirm mobile token alignment:
  - `KC_MOBILE_API_TOKEN` (backend)
  - `EXPO_PUBLIC_MOBILE_API_TOKEN` (apps)
3. Run API smoke tests in QA suite.
4. Verify CI checks are green on all related PRs.
5. Record Jira evidence (PR link + test result summary).
6. Confirm `meta.source` contract in provider/property list responses.
7. Run auth flow regression suite.
8. Verify Wave 11 UI/Auth smoke matrix against current branch before merge.
9. Run Wave 12 role-boundary regression suite and record whether role guard is active for branch-under-test.
10. Run Wave 13 availability regression suite and record endpoint readiness (`404` pre-merge vs contract-asserted post-merge).
11. Run Wave 14 provider identity regression suite and record ownership guard behavior (`PROVIDER_IDENTITY_MISMATCH` + admin override path).
12. Run Wave 15 revision conflict suite and record stale-write behavior (`AVAILABILITY_REVISION_CONFLICT` + reload path).
13. Run Wave 16 manager parity regression suite and record auth + portfolio contract evidence.

## Entry Criteria

- Target branch synced with latest `main`.
- Required wave tasks are merged or in review.
- Token and environment variables are configured.

## Exit Criteria

- Functional smoke suite passes.
- No blocker/high defects in covered flows.
- Jira issue for testing wave is transitioned to `Done`.
- Auth flow regression suite passes.

## Current Automation Baseline

- API smoke tests reside under `tests/Feature/Api/*`.
- Merge pipeline enforces CI checks before orchestrator merge.
- Human approval is mandatory before merge.
