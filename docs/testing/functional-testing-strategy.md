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

## Wave 24 Manager Dashboard Summary and Priorities Matrix

1. Dashboard summary payload parity (`DEV-121`, `DEV-122`, `DEV-123`)
  - `GET /api/properties/summary` returns deterministic envelope with:
    - `data.kpis`
    - `data.priorities[]`
    - `meta.contract=manager-dashboard-summary-v1`
    - `meta.generated_at`
    - `meta.source`
  - Priorities follow deterministic ordering:
    - severity (`high` > `medium` > `low`)
    - ascending `due_at` (nulls last)
    - descending `updated_at`
2. Session and role guardrails (`DEV-121`, `DEV-123`)
  - Provider role access to summary route returns `403 ROLE_SCOPE_FORBIDDEN`.
  - Invalid token against summary route returns deterministic `401 TOKEN_INVALID`.
  - Both forbidden/unauthorized responses preserve `auth-session-v1` envelope metadata.
3. Cross-wave baseline safety (`DEV-123`)
  - Wave 20 `/api/auth/me` unauthorized contract remains stable.
  - Wave 21 assignment-context role guard remains stable.
  - Wave 23 property detail timeline contract remains stable while dashboard summary/priorities are introduced.

## Wave 24 Ticket Mapping

1. `DEV-120` -> Wave 24 orchestration epic and rollout tracking.
2. `DEV-119` -> Manager dashboard summary/priorities architecture contract.
3. `DEV-121` -> Backend summary endpoint + deterministic priorities feed implementation.
4. `DEV-122` -> Mobile manager dashboard summary/priorities UI integration.
5. `DEV-123` -> Regression matrix + API assertions in `tests/Feature/Api/Wave24RegressionMatrixTest.php`.

## Wave 25 Manager Priority Queue Matrix

1. Priority queue contract parity (`DEV-126`, `DEV-127`, `DEV-128`)
  - `GET /api/properties/priorities/queue` returns deterministic envelope with:
    - `data.items[]`
    - `meta.contract=manager-priority-queue-v1`
    - `meta.generated_at`
    - `meta.filters`
    - `meta.count`
  - Queue items expose SLA fields required by manager triage:
    - `sla_due_at`
    - `sla_state` (`on_track|at_risk|overdue|no_deadline`)
  - Ordering remains deterministic:
    - severity (`high` > `medium` > `low`)
    - ascending `sla_due_at` (`null` values last)
    - descending `updated_at`
    - ascending `id` as deterministic tiebreaker
2. Session and role guardrails (`DEV-126`, `DEV-128`)
  - Provider role access to queue route returns `403 ROLE_SCOPE_FORBIDDEN`.
  - Invalid token against queue route returns deterministic `401 TOKEN_INVALID`.
  - Forbidden/unauthorized responses preserve `auth-session-v1` envelope metadata.
3. Cross-wave baseline safety (`DEV-128`)
  - Wave 20 `/api/auth/me` unauthorized contract remains stable.
  - Wave 21 assignment-context role guard remains stable.
  - Wave 22 portfolio filter/pagination contract remains stable.
  - Wave 23 property detail timeline contract remains stable.
  - Wave 24 dashboard summary/priorities contract remains stable while queue payload is introduced.

## Wave 25 Ticket Mapping

1. `DEV-124` -> Wave 25 orchestration epic and rollout tracking.
2. `DEV-125` -> Manager priority queue architecture contract and UX state map.
3. `DEV-126` -> Backend priority queue endpoint + SLA contract implementation.
4. `DEV-127` -> Mobile manager dashboard queue integration and portfolio launch context.
5. `DEV-128` -> Regression matrix + API assertions in `tests/Feature/Api/Wave25RegressionMatrixTest.php`.

## Wave 26 Manager Queue Action Completion Matrix

1. Queue completion mutation contract (`DEV-131`, `DEV-132`, `DEV-133`)
  - `POST /api/properties/priorities/queue/{queueItemId}/complete` returns deterministic envelope:
    - `data.item`
    - `meta.contract=manager-priority-queue-action-v1`
    - `meta.flow=properties_priority_queue_complete`
    - `meta.reason`
  - Success payload includes additive completion fields:
    - `completed`
    - `completed_at`
    - `resolution_code`
    - `note`
  - Repeated completion call returns deterministic conflict:
    - `409 QUEUE_ACTION_CONFLICT`
    - `meta.reason=queue_item_already_completed`
2. Validation, auth, and role guardrails (`DEV-131`, `DEV-133`)
  - Invalid payload returns `422 VALIDATION_ERROR` with deterministic `meta.contract` and `meta.reason=validation_error`.
  - Provider role access to completion endpoint returns `403 ROLE_SCOPE_FORBIDDEN`.
  - Invalid token on completion endpoint returns deterministic `401 TOKEN_INVALID`.
3. Cross-wave baseline safety (`DEV-133`)
  - Wave 20 `/api/auth/me` unauthorized contract remains stable.
  - Wave 21 assignment-context role guard remains stable.
  - Wave 22 filters/pagination contract remains stable.
  - Wave 23 property detail timeline contract remains stable.
  - Wave 24 dashboard summary/priorities contract remains stable.
  - Wave 25 priority queue contract remains stable while queue completion mutation is introduced.

## Wave 26 Ticket Mapping

1. `DEV-129` -> Wave 26 orchestration epic and rollout tracking.
2. `DEV-130` -> Queue action completion architecture contract and UX state map.
3. `DEV-131` -> Backend queue completion endpoint and deterministic mutation envelope.
4. `DEV-132` -> Mobile manager queue action completion flow with optimistic/retry/error states.
5. `DEV-133` -> Regression matrix + API assertions in `tests/Feature/Api/Wave26RegressionMatrixTest.php`.

## Wave 27 Manager Property Form Parity Matrix

1. Enriched manager property create/edit contract (`DEV-134`, `DEV-136`, `DEV-137`)
  - `POST /api/properties` accepts the enriched manager property form payload:
    - `description`, `address`, `postal_code`, `property_type`, `operation_mode`
    - pricing fields (`sale_price`, `rental_price`, `garage_price_category_id`, `garage_price`)
    - characteristics (`bedrooms`, `bathrooms`, `rooms`, `elevator`)
  - `PATCH /api/properties/{id}` accepts the same additive fields and returns deterministic enriched payload.
  - Success responses keep `meta.contract=manager-property-form-v1` with deterministic `flow`/`reason`.
2. Deterministic validation and conflict behavior (`DEV-134`, `DEV-137`)
  - Invalid enriched create payload returns `422 VALIDATION_ERROR` with stable field keys:
    - `sale_price`
    - `rental_price`
    - `garage_price`
    - `bedrooms`
    - `bathrooms`
  - Re-submitting an unchanged enriched edit payload returns `409 PROPERTY_STATE_CONFLICT` with `reason=no_changes`.
3. Role/session guardrails (`DEV-134`, `DEV-136`, `DEV-137`)
  - Provider role access to enriched manager property form mutations returns `403 ROLE_SCOPE_FORBIDDEN`.
  - Invalid token on enriched manager property form mutations returns deterministic `401 TOKEN_INVALID`.
4. Cross-wave baseline safety (`DEV-137`)
  - Wave 20 `/api/auth/me` unauthorized contract remains stable.
  - Wave 21 assignment-context role guard remains stable.
  - Wave 24 dashboard summary contract remains stable.
  - Wave 26 queue completion contract remains stable while Wave 27 form parity is introduced.

## Wave 27 Ticket Mapping

1. `DEV-138` -> Wave 27 orchestration epic and rollout tracking.
2. `DEV-135` -> Manager property form parity architecture contract and UX state map.
3. `DEV-134` -> Backend enriched create/edit property form contract implementation.
4. `DEV-136` -> Mobile manager property form parity UI/API integration.
5. `DEV-137` -> Regression matrix + API assertions in `tests/Feature/Api/Wave27RegressionMatrixTest.php`.

## Wave 28 Manager Auth/Session UX Hardening Matrix

1. Manager login-first UX hardening (`DEV-140`, `DEV-142`, `DEV-143`)
  - Manager login screen starts blank by default unless explicit bootstrap env values are provided.
  - Invalid credentials map to deterministic login UX feedback without exposing raw backend errors.
  - Diagnostics footer is only shown when `EXPO_PUBLIC_SHOW_ENV_DIAGNOSTICS` enables it.
2. Auth success metadata parity (`DEV-140`, `DEV-143`)
  - `POST /api/auth/login` success payload exposes `subject`, `email`, `display_name`, `role`, `scope`.
  - `POST /api/auth/refresh` success payload exposes the same deterministic subject/identity fields.
  - `POST /api/auth/logout` success payload preserves `auth-session-v1` metadata with `flow=logout` and `reason=logout_success`.
  - `GET /api/auth/me` success payload exposes `display_name` for manager runtime bootstrapping.
3. Unauthorized and session-expired recovery (`DEV-142`, `DEV-143`)
  - Manager unauthorized route only offers deterministic return-to-login recovery.
  - Manager session-expired route clears local session and routes back to login.
  - Provider-scope session against manager runtime still returns `403 ROLE_SCOPE_FORBIDDEN`.
4. Cross-wave baseline safety (`DEV-143`)
  - Wave 20 `/api/auth/me` invalid-token contract remains stable.
  - Wave 24 dashboard summary contract remains stable.
  - Wave 27 property form parity contract remains stable while auth/session UX hardening is introduced.

## Wave 28 Ticket Mapping

1. `DEV-139` -> Wave 28 orchestration epic and rollout tracking.
2. `DEV-141` -> Manager auth/session UX hardening architecture contract.
3. `DEV-140` -> Backend auth success metadata hardening.
4. `DEV-142` -> Mobile manager login/session recovery UX hardening.
5. `DEV-143` -> Regression matrix + API assertions in `tests/Feature/Api/Wave28RegressionMatrixTest.php`.

## Wave 29 Manager Provider Handoff Evidence Matrix

1. Assignment evidence success path (`DEV-145`, `DEV-146`, `DEV-148`, `DEV-147`)
  - `POST /api/properties/{id}/assign-provider` returns additive success evidence under `manager-provider-handoff-v1`.
  - Success payload includes:
    - `data.assignment`
    - `data.latest_timeline_event`
  - `data.assignment.provider` exposes deterministic provider snapshot fields used by manager mobile without a follow-up detail fetch.
2. Guardrail and recovery behavior (`DEV-145`, `DEV-148`, `DEV-147`)
  - Inactive provider still returns `409 ASSIGNMENT_CONFLICT` with `reason=provider_inactive`.
  - Provider role access still returns `403 ROLE_SCOPE_FORBIDDEN`.
  - Invalid/expired token still returns deterministic `401` auth-session envelope on assignment route.
3. Cross-wave baseline safety (`DEV-147`)
  - Wave 21 assignment-context still resolves assigned state after assignment mutation.
  - Wave 24 dashboard summary contract remains stable.
  - Wave 28 manager auth/session invalid-token baseline remains stable while assignment evidence is introduced.

## Wave 29 Ticket Mapping

1. `DEV-144` -> Wave 29 orchestration epic and rollout tracking.
2. `DEV-146` -> Manager provider handoff evidence contract and UX state map.
3. `DEV-145` -> Backend additive assignment evidence payload implementation.
4. `DEV-148` -> Mobile manager handoff success evidence UX integration.
5. `DEV-147` -> Regression matrix + API assertions in `tests/Feature/Api/Wave29RegressionMatrixTest.php`.

## Wave 30 Manager Provider Directory Matrix

1. Directory and detail success contract (`DEV-152`, `DEV-151`, `DEV-153`)
  - `GET /api/providers` returns manager-facing provider directory payload with:
    - `meta.contract=manager-provider-directory-v1`
    - additive pagination metadata (`page`, `per_page`, `total`, `total_pages`, `has_next_page`)
    - additive filter echo (`role`, `status`, `category`, `city`, `search`)
  - `data[]` exposes deterministic list fields:
    - `id`, `name`, `category`, `city`, `status`, `rating`
    - `availability_summary`
    - `services_preview`
  - `GET /api/providers/{id}` returns manager-facing provider profile payload with:
    - `meta.contract=manager-provider-directory-v1`
    - `data.bio`, `data.phone`, `data.email`, `data.services`, `data.coverage`
    - `data.metrics.completed_jobs`, `data.metrics.response_time_hours`, `data.metrics.customer_score`
2. Role/session guardrails (`DEV-152`, `DEV-153`)
  - Invalid token on provider directory/profile routes returns deterministic `401 TOKEN_INVALID` auth-session envelope.
  - Invalid role on provider directory/profile routes returns deterministic `403 ROLE_SCOPE_FORBIDDEN` auth-session envelope.
  - Unknown provider detail keeps deterministic `404` payload with `message=Provider not found` and `provider_id`.
3. Cross-wave baseline safety (`DEV-153`)
  - Wave 20 `/api/auth/me` invalid-token contract remains stable.
  - Wave 21 assignment-context role guard remains stable.
  - Wave 23 property detail timeline contract remains stable.
  - Wave 24 dashboard summary contract remains stable while manager provider directory/profile flows are introduced.

## Wave 30 Ticket Mapping

1. `DEV-150` -> Wave 30 orchestration epic and rollout tracking.
2. `DEV-149` -> Manager provider directory/profile architecture contract and UX state map.
3. `DEV-152` -> Backend manager provider directory/profile contract implementation.
4. `DEV-151` -> Mobile manager provider directory/profile UI integration.
5. `DEV-153` -> Regression matrix + readiness-gated API assertions in `tests/Feature/Api/Wave30RegressionMatrixTest.php` and `tests/Feature/Api/ProviderApiTest.php`.

## Wave 31 Manager Assignment Center Matrix

1. Assignment center queue and detail success contract (`DEV-154`, `DEV-158`, `DEV-155`)
  - `GET /api/properties/priorities/queue` keeps `meta.contract=manager-priority-queue-v1` while extending additive filter echoes:
    - `meta.filters.status`
    - `meta.filters.search`
  - Assignment-center list is consumed through `category=provider_assignment` with deterministic `status`, `search`, and `limit` inputs.
  - `GET /api/properties/priorities/queue/{queueItemId}` returns manager-facing assignment-center detail payload with:
    - `meta.contract=manager-assignment-center-v1`
    - `data.item`
    - `data.property`
    - `data.provider`
    - `data.assignment`
    - `data.timeline`
2. Role/session/not-found guardrails (`DEV-154`, `DEV-155`)
  - Provider role access to queue-detail route returns deterministic `403 ROLE_SCOPE_FORBIDDEN` auth-session envelope.
  - Invalid token on queue-detail route returns deterministic `401 TOKEN_INVALID` auth-session envelope.
  - Unknown queue item keeps deterministic `404 QUEUE_ITEM_NOT_FOUND` with `queue_item_id`.
3. Cross-wave baseline safety (`DEV-155`)
  - Wave 24 dashboard summary contract remains stable while the dedicated assignment center is added.
  - Wave 26 queue completion contract remains stable for manager queue actions.
  - Wave 30 provider directory/profile contract remains stable for downstream handoff/provider review flows.

## Wave 31 Ticket Mapping

1. `DEV-157` -> Wave 31 orchestration epic and rollout tracking.
2. `DEV-156` -> Manager assignment center architecture contract and UX state map.
3. `DEV-154` -> Backend manager assignment center list/detail contract implementation.
4. `DEV-158` -> Mobile manager assignment center UI integration.
5. `DEV-155` -> Regression matrix + readiness-gated API assertions in `tests/Feature/Api/Wave31RegressionMatrixTest.php`.

## Wave 32 Manager Assignment Status Matrix

1. Assignment status action success contract (`DEV-161`, `DEV-162`, `DEV-163`)
  - `PATCH /api/properties/priorities/queue/{queueItemId}/assignment` returns deterministic envelope:
    - `meta.contract=manager-assignment-status-v1`
    - `meta.flow=properties_priority_queue_assignment_update`
    - additive `data.assignment`
    - additive `data.available_actions`
  - `action=reassign` updates provider snapshot and leaves `available_actions=["complete","reassign","cancel"]`.
  - `action=complete` transitions assignment to `completed`, preserves provider evidence, and clears follow-up actions.
  - `action=cancel` transitions assignment to `cancelled`, clears provider linkage, and clears follow-up actions.
2. Guardrails for assignment status actions (`DEV-161`, `DEV-163`)
  - Provider role access returns `403 ROLE_SCOPE_FORBIDDEN` with `auth-session-v1` envelope.
  - Invalid token returns deterministic `401 TOKEN_INVALID` envelope.
  - Invalid payload returns `422 VALIDATION_ERROR`.
  - Invalid transition or inactive-provider reassignment returns `409 ASSIGNMENT_ACTION_CONFLICT`.
3. Cross-wave baseline safety (`DEV-163`)
  - Wave 31 assignment center queue/detail list flows remain stable while assignment status mutations are introduced.

## Wave 32 Ticket Mapping

1. `DEV-160` -> Wave 32 orchestration epic and rollout tracking.
2. `DEV-159` -> Assignment status architecture contract and UX state map.
3. `DEV-161` -> Backend assignment status mutation endpoint implementation.
4. `DEV-162` -> Mobile manager assignment detail actions and provider-directory selection flow.
5. `DEV-163` -> Regression matrix + readiness-gated API assertions in `tests/Feature/Api/Wave32RegressionMatrixTest.php`.

## Wave 33 Manager Assignment Media Evidence Matrix

1. Assignment evidence list/upload success contract (`DEV-166`, `DEV-167`, `DEV-168`)
  - `GET /api/properties/priorities/queue/{queueItemId}/evidence` returns deterministic envelope:
    - `meta.contract=manager-assignment-evidence-v1`
    - `meta.flow=properties_priority_queue_assignment_evidence`
    - additive `data.items[]`
    - additive `data.count`
  - `POST /api/properties/priorities/queue/{queueItemId}/evidence` accepts multipart uploads for:
    - `category=before_photo|after_photo|invoice|report|permit|other`
    - backend-issued `preview_url` and `download_url`
    - additive `data.latest_item`
  - list refresh remains in the assignment detail workspace and does not require a separate property-detail fetch.
2. Guardrails for assignment evidence workflow (`DEV-166`, `DEV-168`)
  - invalid token returns `401 TOKEN_INVALID` with `auth-session-v1` envelope.
  - provider role returns `403 ROLE_SCOPE_FORBIDDEN` with `auth-session-v1` envelope.
  - unknown queue item returns `404 QUEUE_ITEM_NOT_FOUND`.
  - invalid category or missing file returns `422 VALIDATION_ERROR`.
  - oversized file returns `413 FILE_TOO_LARGE`.
  - unsupported media returns `415 UNSUPPORTED_MEDIA_TYPE`.
3. Baseline compatibility (`DEV-166`, `DEV-167`, `DEV-168`)
  - Wave 32 assignment detail contract remains stable:
    - `GET /api/properties/priorities/queue/{queueItemId}`
    - `meta.contract=manager-assignment-center-v1`
    - assignment status and available actions remain deterministic.
  - Wave 33 adds media/document evidence as a separate workspace concern and does not replace prior assignment state evidence.

## Wave 33 Ticket Mapping

1. `DEV-164` -> Wave 33 orchestration epic and rollout tracking.
2. `DEV-165` -> Assignment media evidence architecture contract and UX state map.
3. `DEV-166` -> Backend assignment evidence upload/list implementation.
4. `DEV-167` -> Mobile manager assignment detail evidence UI.
5. `DEV-168` -> Regression matrix + readiness-gated API assertions in `tests/Feature/Api/Wave33RegressionMatrixTest.php`.

## Wave 34 Manager Provider Profile Scorecard Matrix

1. Queue-aware provider profile scorecard contract (`DEV-171`, `DEV-172`, `DEV-173`)
  - `GET /api/providers/{id}?queue_item_id={queueItemId}` returns additive scorecard data under:
    - `meta.contract=manager-provider-directory-v1`
    - `data.assignment_fit`
  - `data.assignment_fit` exposes deterministic fields:
    - `recommended`
    - `score_label`
    - `match_reasons`
    - `warnings`
    - `next_action`
  - Success path remains additive: baseline provider profile fields are unchanged when scorecard context is requested.
2. Guardrails for queue-aware provider profile (`DEV-171`, `DEV-173`)
  - Provider role attempting queue-aware provider profile read returns `403 ROLE_SCOPE_FORBIDDEN` with `auth-session-v1` envelope.
  - Invalid token on queue-aware provider profile read returns deterministic `401 TOKEN_INVALID` envelope.
  - Unknown provider detail remains deterministic `404` provider-not-found payload.
  - Unknown `queue_item_id` returns `404 QUEUE_ITEM_NOT_FOUND` with deterministic `meta.flow=providers_show`.
3. Baseline compatibility (`DEV-171`, `DEV-172`, `DEV-173`)
  - `GET /api/providers/{id}` without `queue_item_id` preserves Wave 30 provider profile shape.
  - Generic manager provider directory browsing remains unaffected when no assignment selection context exists.

## Wave 34 Ticket Mapping

1. `DEV-169` -> Wave 34 orchestration epic and rollout tracking.
2. `DEV-170` -> Manager provider profile scorecard architecture contract and UX state map.
3. `DEV-171` -> Backend queue-aware provider profile scorecard implementation.
4. `DEV-172` -> Mobile provider profile scorecard + select-from-profile flow.
5. `DEV-173` -> Regression matrix + readiness-gated API assertions in `tests/Feature/Api/Wave34RegressionMatrixTest.php`.

## Wave 35 Manager Assignment Decision Timeline Matrix

1. Assignment detail additive decision summary (`DEV-176`, `DEV-177`, `DEV-178`)
  - `GET /api/properties/priorities/queue/{queueItemId}` preserves:
    - `meta.contract=manager-assignment-center-v1`
    - baseline `data.assignment`, `data.provider`, `data.timeline`
  - Additive Wave 35 node:
    - `data.decision_summary`
      - `current_state`
      - `latest_decision_label`
      - `latest_decision_at`
      - `latest_actor`
      - `evidence_count`
      - `has_evidence`
      - `next_recommended_action`
2. Timeline metadata semantics (`DEV-176`, `DEV-177`, `DEV-178`)
  - Assignment detail timeline remains deterministic and descending by `occurred_at`.
  - Timeline rows may expose:
    - `metadata.event_kind`
      - `assignment_created`
      - `provider_reassigned`
      - `assignment_completed`
      - `assignment_cancelled`
      - `evidence_uploaded`
    - `metadata.status_badge`
    - `metadata.evidence_count`
    - `metadata.provider_id`
  - Manager UI may ignore these additive keys without breaking existing assignment actions.
3. Guardrails and compatibility (`DEV-176`, `DEV-178`)
  - Provider role hitting queue detail returns `403 ROLE_SCOPE_FORBIDDEN` with `auth-session-v1` envelope.
  - Invalid token returns deterministic `401 TOKEN_INVALID` envelope.
  - Unknown queue item returns deterministic `404 QUEUE_ITEM_NOT_FOUND` payload.
  - Baseline assignment detail remains additive: existing clients that ignore `decision_summary` continue to work.

## Wave 35 Ticket Mapping

1. `DEV-174` -> Wave 35 orchestration epic and rollout tracking.
2. `DEV-175` -> Manager assignment decision timeline architecture contract and UX state map.
3. `DEV-176` -> Backend additive decision summary + timeline metadata implementation.
4. `DEV-177` -> Mobile assignment detail decision summary + timeline rendering.
5. `DEV-178` -> Regression matrix + readiness-gated API assertions in `tests/Feature/Api/Wave35RegressionMatrixTest.php`.

## Wave 36 Manager Assignment Center Decision Rollup Matrix

1. Assignment center additive decision rollup contract (`DEV-180`, `DEV-181`, `DEV-182`, `DEV-183`)
  - `GET /api/properties/priorities/queue?category=provider_assignment`
    preserves:
    - `meta.contract=manager-priority-queue-v1`
    - baseline queue card fields (`id`, `property_id`, `property_title`, `city`, `status`, `severity`, `sla_*`, `action`)
  - Additive Wave 36 node:
    - `data.items[*].decision_rollup`
      - `current_state`
      - `latest_decision_label`
      - `latest_decision_at`
      - `evidence_count`
      - `has_evidence`
      - `status_badge`
      - `next_recommended_action`
2. Decision rollup semantics (`DEV-181`, `DEV-182`, `DEV-183`)
  - Provider-assignment queue cards expose deterministic list-level state hints without opening detail.
  - Reassignment + evidence upload must update rollup state to assigned/evidence-backed semantics.
  - Completion must update rollup state to terminal completed semantics with no follow-up recommendation.
3. Guardrails and compatibility (`DEV-182`, `DEV-183`)
  - Provider role hitting queue list returns `403 ROLE_SCOPE_FORBIDDEN` with `auth-session-v1` envelope.
  - Invalid token returns deterministic `401 TOKEN_INVALID` envelope.
  - Baseline queue behavior remains additive: consumers ignoring `decision_rollup` continue to function.

## Wave 36 Ticket Mapping

1. `DEV-179` -> Wave 36 orchestration epic and rollout tracking.
2. `DEV-180` -> Manager assignment center decision rollup architecture contract and UX state map.
3. `DEV-182` -> Backend additive queue-list decision rollup implementation.
4. `DEV-181` -> Mobile assignment center decision rollup UI.
5. `DEV-183` -> Regression matrix + readiness-gated API assertions in `tests/Feature/Api/Wave36RegressionMatrixTest.php`.
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
21. Run Wave 24 dashboard summary/priorities regression suite and record ordering + summary guardrail evidence.
22. Run Wave 25 priority queue regression suite and record SLA fields/order + queue guardrail evidence.
23. Run Wave 26 queue completion regression suite and record success/conflict/validation + forbidden/unauthorized evidence.
24. Run Wave 27 manager property form parity regression suite and record enriched create/edit/validation/conflict guardrail evidence.
25. Run Wave 28 manager auth/session UX regression suite and record success metadata parity plus login/session recovery evidence.
26. Run Wave 29 manager handoff evidence regression suite and record additive assignment evidence plus recovery guardrail stability.
27. Run Wave 30 manager provider directory/profile regression suite and record readiness-gated list/detail contract evidence plus guardrail stability.
28. Run Wave 31 manager assignment center regression suite and record additive queue filter echoes, detail contract evidence, and queue-detail guardrail stability.
29. Run Wave 32 assignment status workflow regression suite and record reassign/complete/cancel evidence plus guardrail stability.
30. Run Wave 33 assignment media evidence regression suite and record list/upload success envelopes plus guardrail stability.
31. Run Wave 34 provider profile scorecard regression suite and record queue-aware success, guardrail stability, and baseline provider profile compatibility.
32. Run Wave 35 assignment decision timeline regression suite and record additive decision summary semantics plus reassignment/evidence/completion/cancellation metadata stability.
33. Run Wave 36 assignment center decision rollup regression suite and record additive queue-card status/evidence/next-action semantics plus queue-list guardrail stability.
34. Run Wave 37 manager provider directory scorecard regression suite and record additive list/detail scorecard semantics plus provider directory guardrail stability.
35. Run Wave 38 manager provider handoff fit regression suite and record additive candidate fit preview/selection-state semantics plus handoff/profile guardrail stability.

## Wave 37 Manager Provider Directory Scorecard Matrix

1. Provider directory success contract (`DEV-185`, `DEV-187`, `DEV-188`)
  - `GET /api/providers` keeps `meta.contract=manager-provider-directory-v1` while extending each list row with additive `scorecard_preview`:
    - `completed_jobs`
    - `customer_score`
    - `response_time_hours`
    - `availability_label`
    - `coverage_count`
    - `services_count`
  - Manager-safe filters stay deterministic for `status`, `category`, `city`, and `search`.
  - Baseline list nodes remain stable: `availability_summary`, `services_preview`, pagination metadata, and filter echoes.
2. Provider profile scorecard success contract (`DEV-185`, `DEV-187`, `DEV-188`)
  - `GET /api/providers/{id}` keeps `meta.contract=manager-provider-directory-v1` while extending provider detail with additive `scorecard`:
    - `completed_jobs`
    - `customer_score`
    - `response_time_hours`
    - `availability_label`
    - `coverage_count`
    - `services_count`
    - `status_badge`
  - Baseline detail nodes remain stable: `bio`, `phone`, `email`, `services`, `coverage`, `availability_summary`, and `metrics`.
3. Role/session guardrails and cross-wave baseline safety (`DEV-188`)
  - Invalid token on provider directory/profile routes returns deterministic `401 TOKEN_INVALID` auth-session envelope.
  - Invalid role on provider directory/profile routes returns deterministic `403 ROLE_SCOPE_FORBIDDEN` auth-session envelope.
  - Unknown provider detail keeps deterministic `404` payload with `message=Provider not found` and `provider_id`.
  - Queue-aware provider profile behavior from Wave 34 remains additive and optional when `queue_item_id` is absent.

## Wave 38 Manager Provider Handoff Candidate Fit Matrix

1. Provider-candidate fit success contract (`DEV-190`, `DEV-191`, `DEV-192`, `DEV-193`)
  - `GET /api/properties/{id}/provider-candidates` keeps `meta.contract=manager-provider-handoff-v1`
    while extending each candidate row with additive nodes:
    - `fit_preview.score_label`
    - `fit_preview.recommendation_badge`
    - `fit_preview.match_reasons[]`
    - `fit_preview.warnings[]`
    - `fit_preview.next_action_hint`
    - `selection_state.queue_status`
    - `selection_state.can_select`
    - `selection_state.blocked_reason`
    - `selection_state.confirmation_copy.{title,body,confirm_label}`
  - Baseline candidate identity fields remain stable: `id`, `name`, `role`, `status`, `category`, `city`, `rating`.
2. Handoff guardrails (`DEV-193`)
  - Invalid token on provider-candidates returns deterministic `401 TOKEN_INVALID` auth-session envelope.
  - Invalid role on provider-candidates returns deterministic `403 ROLE_SCOPE_FORBIDDEN` auth-session envelope.
  - Unknown property keeps deterministic `404 PROPERTY_NOT_FOUND` payload with `property_id`.
3. Cross-wave compatibility (`DEV-193`)
  - Wave 19 assignment mutation remains stable after fit-preview rollout.
  - Wave 34 queue-aware provider profile remains the deep-read surface for assignment decisions.
  - Consumers ignoring `fit_preview` and `selection_state` continue to function with the baseline handoff contract.

## Wave 39 Manager Dashboard Pending Actions Matrix

1. Pending actions success contract (`DEV-196`, `DEV-197`, `DEV-198`, `DEV-195`)
  - `GET /api/properties/priorities/pending-actions` returns:
    - `meta.contract=manager-dashboard-pending-actions-v1`
    - additive `data[*]` nodes:
      - `id`
      - `action_type`
      - `entity_type`
      - `entity_id`
      - `title`
      - `subtitle`
      - `status_badge`
      - `priority_badge`
      - `due_at`
      - `updated_at`
      - `deep_link.route`
      - `deep_link.params.queue_item_id`
      - `deep_link.params.property_id`
  - Manager dashboard consumers may route handoff actions to `ManagerToProviderHandoff` and contract follow-up actions to `ManagerAssignmentDetail` using the additive deep-link metadata.
2. Empty-state and guardrails (`DEV-195`)
  - Empty dataset returns deterministic `200` envelope with:
    - `data=[]`
    - `meta.count=0`
    - `meta.counts.total=0`
    - `meta.counts.high_priority=0`
  - Provider role access returns deterministic `403 ROLE_SCOPE_FORBIDDEN` auth-session envelope.
  - Invalid token returns deterministic `401 TOKEN_INVALID` auth-session envelope.
3. Cross-wave compatibility (`DEV-195`)
  - Wave 24 dashboard summary contract remains stable while pending actions are added as a separate additive endpoint.
  - Wave 31 assignment center and Wave 38 provider handoff fit flows remain the downstream navigation surfaces referenced by pending action deep links.

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
