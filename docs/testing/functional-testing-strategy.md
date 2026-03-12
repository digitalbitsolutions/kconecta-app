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

## Wave 17 Manager Property Actions Matrix

1. Manager mutation contract (`DEV-88`, `DEV-86`, `DEV-87`)
  - `/api/properties/{id}/reserve` returns `meta.contract=property-mutation-v1` and `meta.flow=properties_reserve`.
  - `/api/properties/{id}/release` returns `meta.contract=property-mutation-v1` and `meta.flow=properties_release`.
  - `PATCH /api/properties/{id}` returns `meta.contract=property-mutation-v1` and `meta.flow=properties_update`.
2. Conflict and guardrail behavior (`DEV-88`, `DEV-87`)
  - Reserving an already reserved property returns `409 PROPERTY_STATE_CONFLICT` with deterministic `meta.reason`.
  - Updating with unchanged status returns `409 PROPERTY_STATE_CONFLICT`.
  - Provider role access to manager mutations returns `403 ROLE_SCOPE_FORBIDDEN`.
  - Invalid/missing token on manager mutation routes returns `401 TOKEN_INVALID`.
3. Baseline safety (`DEV-87`)
  - Wave 16 manager portfolio list/detail contract remains stable while mutation routes are introduced.
  - Wave 14/15 provider availability ownership/revision behavior remains unchanged.

## Wave 17 Ticket Mapping

1. `DEV-84` -> Wave 17 orchestration epic and rollout tracking.
2. `DEV-85` -> Manager property mutation architecture contract/state map.
3. `DEV-88` -> Backend reserve/release/status mutation endpoints and deterministic envelope.
4. `DEV-86` -> Mobile manager property actions wired to mutation API and UX feedback states.
5. `DEV-87` -> Regression matrix and API assertions in `tests/Feature/Api/Wave17RegressionMatrixTest.php`.

## Wave 18 Manager Auth + Property Form Matrix

1. Manager auth/session hardening (`DEV-90`, `DEV-92`)
  - `401 TOKEN_EXPIRED` still routes through refresh-first semantics.
  - `TOKEN_INVALID` and `TOKEN_REVOKED` remain deterministic hard-reset auth outcomes.
  - Logout keeps deterministic teardown semantics (credentials removed, auth entry route).
2. Manager property create/edit form contract (`DEV-91`, `DEV-93`, `DEV-92`)
  - `POST /api/properties` returns `meta.contract=manager-property-form-v1` and `meta.flow=properties_create`.
  - `PATCH /api/properties/{id}` accepts form payload fields (`title`, `city`, `status`, `price`) and returns deterministic mutation payload.
  - Validation failures return `422 VALIDATION_ERROR` with `error.fields` map for field-level UI feedback.
3. Role and session guardrails (`DEV-91`, `DEV-92`)
  - Provider role attempting manager property form mutations returns `403 ROLE_SCOPE_FORBIDDEN`.
  - Invalid token on create/edit endpoints returns deterministic `401 TOKEN_INVALID` envelope.
4. Cross-wave baseline safety (`DEV-92`)
  - Wave 16 manager portfolio read contract remains stable.
  - Wave 17 reserve/release/status mutation contract remains stable while Wave 18 form endpoints are introduced.

## Wave 18 Ticket Mapping

1. `DEV-89` -> Wave 18 orchestration epic and rollout tracking.
2. `DEV-90` -> Manager auth/session hardening + property form architecture contract.
3. `DEV-91` -> Backend create/edit endpoints and validation envelope implementation.
4. `DEV-93` -> Mobile manager property editor flow and API wiring.
5. `DEV-92` -> Regression matrix and API assertions in `tests/Feature/Api/Wave18RegressionMatrixTest.php`.

## Wave 19 Manager-Provider Handoff Matrix

1. Provider candidate discovery (`DEV-96`, `DEV-97`, `DEV-98`)
  - `GET /api/properties/{id}/provider-candidates` returns deterministic candidate payload.
  - Response contract remains `manager-provider-handoff-v1` with stable `flow`/`reason`.
2. Provider assignment mutation (`DEV-96`, `DEV-97`, `DEV-98`)
  - `POST /api/properties/{id}/assign-provider` returns deterministic assignment envelope on success.
  - Validation failures return `422 VALIDATION_ERROR` with `error.fields.provider_id`.
  - Unknown provider returns `404 PROVIDER_NOT_FOUND`.
  - Inactive provider returns `409 ASSIGNMENT_CONFLICT` with `reason=provider_inactive`.
3. Session and role guardrails (`DEV-96`, `DEV-97`, `DEV-98`)
  - Provider role access to handoff routes returns `403 ROLE_SCOPE_FORBIDDEN`.
  - Invalid/expired token keeps deterministic `401` auth-session envelope.
4. Cross-wave safety baseline (`DEV-98`)
  - Wave 16-18 manager portfolio and mutation/form contracts remain stable after Wave 19 additions.

## Wave 19 Ticket Mapping

1. `DEV-94` -> Wave 19 orchestration epic and rollout tracking.
2. `DEV-95` -> Manager-provider handoff architecture contract.
3. `DEV-96` -> Backend candidate + assignment endpoints.
4. `DEV-97` -> Mobile manager handoff UI/API wiring.
5. `DEV-98` -> Regression matrix + API assertions in `tests/Feature/Api/Wave19RegressionMatrixTest.php`.

## Wave 20 Manager Login-First Session Matrix

1. Login-first bootstrap contract (`DEV-100`, `DEV-102`, `DEV-103`)
  - Manager app boot resolves session through `/api/auth/me` before entering dashboard route.
  - Missing token routes to `Login`.
  - `401 TOKEN_INVALID/TOKEN_EXPIRED` routes to `SessionExpired`.
  - `403 ROLE_SCOPE_FORBIDDEN` routes to `Unauthorized`.
2. Auth introspection endpoint contract (`DEV-101`, `DEV-103`)
  - `GET /api/auth/me` returns deterministic `auth-session-v1` envelope for valid manager/admin session.
  - Unauthorized requests return deterministic `401` envelope with `flow=me`.
  - Provider-scope session against manager runtime contract returns deterministic `403 ROLE_SCOPE_FORBIDDEN`.
3. Cross-wave baseline protection (`DEV-103`)
  - Wave 16 manager portfolio read contract remains stable.
  - Wave 17-19 manager property mutation + provider handoff contracts remain stable while login-first flow is introduced.

## Wave 20 Ticket Mapping

1. `DEV-99` -> Wave 20 orchestration epic and rollout tracking.
2. `DEV-100` -> Manager login-first architecture/session contract.
3. `DEV-101` -> Backend `/api/auth/me` session introspection endpoint.
4. `DEV-102` -> Mobile login-first bootstrap and deterministic auth fallback routing.
5. `DEV-103` -> Regression matrix + API assertions in `tests/Feature/Api/Wave20RegressionMatrixTest.php`.

## Wave 21 Manager Assignment Context Matrix

1. Assignment-context endpoint parity (`DEV-106`, `DEV-107`, `DEV-108`)
  - `GET /api/properties/{id}/assignment-context` returns deterministic assignment payload.
  - Unassigned property context returns `state=unassigned` with `assigned=false`.
  - Assigned property context returns `state=assigned` with provider snapshot payload.
2. Session and scope guardrails (`DEV-106`, `DEV-108`)
  - Provider role access returns `403 ROLE_SCOPE_FORBIDDEN` with deterministic auth-session envelope.
  - Invalid/expired tokens return deterministic `401` auth-session envelope.
3. Cross-wave baseline safety (`DEV-108`)
  - Wave 19 provider handoff endpoints remain stable.
  - Wave 20 login-first/auth-me session contracts remain stable.

## Wave 21 Ticket Mapping

1. `DEV-104` -> Wave 21 orchestration epic and rollout tracking.
2. `DEV-105` -> Assignment-context architecture contract/state map.
3. `DEV-106` -> Backend assignment-context endpoint implementation.
4. `DEV-107` -> Manager property detail + handoff assignment-context UI wiring.
5. `DEV-108` -> Regression matrix + API assertions in `tests/Feature/Api/Wave21RegressionMatrixTest.php`.

## Wave 22 Manager Portfolio Filter + Pagination Matrix

1. Filter combinations (`DEV-111`, `DEV-112`, `DEV-113`)
  - `/api/properties` accepts additive `status`, `city`, `search`, `page`, `per_page` filters.
  - `meta.filters` echoes active filters in deterministic shape.
  - Invalid filter values keep deterministic `422` validation envelope.
2. Pagination boundary behavior (`DEV-111`, `DEV-112`, `DEV-113`)
  - Response includes `meta.page`, `meta.per_page`, `meta.total`, `meta.total_pages`, `meta.has_next_page`.
  - Empty result sets keep deterministic pagination values (`count=0`, `total=0`, `total_pages=0`, `has_next_page=false`).
  - Boundary pages preserve deterministic `has_next_page` semantics.
3. Baseline protection (`DEV-113`)
  - Wave 20 login/session guardrails remain stable (`401 TOKEN_INVALID` + `auth-session-v1` envelope).
  - Wave 21 assignment-context guardrails remain stable (`403 ROLE_SCOPE_FORBIDDEN` + deterministic flow metadata).

## Wave 22 Ticket Mapping

1. `DEV-109` -> Wave 22 orchestration epic and rollout tracking.
2. `DEV-110` -> Manager portfolio filter/pagination architecture contract.
3. `DEV-111` -> Backend filters + pagination endpoint contract implementation.
4. `DEV-112` -> Mobile manager portfolio UI filters + next-page loading.
5. `DEV-113` -> Regression matrix + API assertions in `tests/Feature/Api/Wave22RegressionMatrixTest.php`.

## Wave 23 Manager Property Detail Timeline Matrix

1. Manager property detail timeline contract (`DEV-116`, `DEV-117`, `DEV-118`)
  - `GET /api/properties/{id}` exposes `data.timeline[]` with deterministic fields:
    - `id`, `type`, `occurred_at`, `actor`, `summary`, `metadata`
  - Timeline includes assignment and status transition events with descending chronological order.
  - Empty or pre-merge timeline payloads are tracked as matrix readiness gates for branch-under-test.
2. Session and role guardrails for property detail (`DEV-116`, `DEV-118`)
  - Provider role against manager detail route returns `403 ROLE_SCOPE_FORBIDDEN`.
  - Invalid token against manager detail route returns `401 TOKEN_INVALID`.
  - Guardrail envelopes keep deterministic `auth-session-v1` metadata (`contract`, `flow`, `reason`, `retryable`).
3. Cross-wave baseline safety (`DEV-118`)
  - Wave 20 `auth/me` unauthorized contract remains stable.
  - Wave 21 assignment-context role guard remains stable.
  - Wave 22 filters/pagination contract remains stable while timeline payload is introduced.

## Wave 23 Ticket Mapping

1. `DEV-114` -> Wave 23 orchestration epic and rollout tracking.
2. `DEV-115` -> Manager detail timeline architecture contract/state map.
3. `DEV-116` -> Backend detail timeline payload implementation.
4. `DEV-117` -> Mobile manager detail/handoff timeline UI integration.
5. `DEV-118` -> Regression matrix + API assertions in `tests/Feature/Api/Wave23RegressionMatrixTest.php`.

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
14. Run Wave 17 manager mutation regression suite and record reserve/release/update guardrail evidence.
15. Run Wave 18 manager auth/property-form regression suite and record validation field-map + create/edit evidence.
16. Run Wave 19 manager-provider handoff regression suite and record candidates/assignment envelope evidence.
17. Run Wave 20 login-first session regression suite and record bootstrap/auth-me deterministic routing evidence.
18. Run Wave 21 assignment-context regression suite and record assigned/unassigned/forbidden/unauthorized evidence.
19. Run Wave 22 portfolio filter/pagination regression suite and record filter echoes, pagination boundaries, and guardrail evidence.
20. Run Wave 23 property detail timeline regression suite and record timeline ordering plus detail guardrail evidence.

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
