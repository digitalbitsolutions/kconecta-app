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

### Wave 14 Identity-Driven Availability UX

- Provider availability editor bootstrap:
  - Resolve `providerId` from session store claims, not from hardcoded constants.
  - If session has no provider identity, route to `SessionExpired`.
- Provider ownership mismatch:
  - `403 PROVIDER_IDENTITY_MISMATCH` must render deterministic ownership error state.
  - Editor controls stay disabled until session is re-established for the correct provider identity.
- Provider role mismatch:
  - `403 ROLE_SCOPE_FORBIDDEN` keeps session active and shows read-only fallback.
- Manager app behavior:
  - Manager sees provider availability as read-only context.
  - Manager never receives editable availability controls in native flow.

### Wave 15 Availability Conflict UX

- Provider editor save flow:
  - Each save request includes latest `revision` read from server.
  - UI enters `availability_saving` and blocks duplicate writes.
- Stale revision conflict (`409 AVAILABILITY_REVISION_CONFLICT`):
  - Enter deterministic `availability_conflict` state.
  - Explain that schedule changed remotely and local draft is stale.
  - Disable save controls until reload is completed.
  - Provide CTA: `Reload Availability` and secondary CTA: `Discard Local Draft`.
- Conflict recovery:
  - After reload, UI restores editable mode with updated revision token.
  - Retry path remains in same screen context (no forced logout/navigation).
- Identity + conflict combined handling:
  - If `403 PROVIDER_IDENTITY_MISMATCH`, keep Wave 14 ownership lock behavior.
  - Conflict state never overrides auth/session error precedence (`401` first).

### Wave 13 Delivery Sequencing

1. Availability contract and UX map (`ARCH-009`).
2. Availability API + role guards (`BE-011`).
3. Provider availability editor screen integration (`MOB-010`).
4. Availability regression matrix (`QA-012`).

## Wave 15 Delivery Sequencing

1. Availability revision/conflict contract (`ARCH-011`).
2. Backend optimistic concurrency guard for availability updates (`BE-013`).
3. Provider editor conflict UX + reload/retry path (`MOB-012`).
4. Regression coverage for revision conflicts and Wave 14 baseline (`QA-014`).

## Wave 16 Manager Deterministic State Map

### Manager Login and Session States

- `manager_login_idle`
  - Email/password inputs enabled.
  - Submit CTA available.
- `manager_login_submitting`
  - Disable submit to avoid duplicate requests.
  - Keep context on same screen.
- `manager_login_error`
  - Show deterministic auth error copy from envelope.
  - Keep entered email; clear password only if required by policy.
- `manager_session_expired`
  - Route to `SessionExpired`.
  - Primary CTA: `Sign in again`.
- `manager_unauthorized_role`
  - Route to `Unauthorized`.
  - Explain role mismatch and provide return CTA.

### Manager Dashboard States

- `dashboard_loading`
  - Show KPI skeletons/spinners.
- `dashboard_ready`
  - Render KPI cards from API summary payload.
- `dashboard_empty`
  - Render zero-state when no portfolio metrics are available.
- `dashboard_error`
  - Show deterministic retryable error block and `Retry` CTA.
- `dashboard_unauthorized`
  - For `403 ROLE_SCOPE_FORBIDDEN`, keep session and route to unauthorized state.

### Property List States

- `list_loading`
  - Blocking loading state on initial fetch.
- `list_ready`
  - Render rows and active filter chips.
- `list_empty`
  - No results state with clear-filter guidance.
- `list_filtering`
  - Non-blocking refresh while query/filter changes are applied.
- `list_error`
  - Deterministic error state with `Retry` CTA and preserved filter inputs.

## Wave 17 Manager Property Mutation State Map

- `property_mutation_pending`
  - Show loading indicator and pending state.
  - Disable duplicate mutation actions.
- `property_mutation_success`
  - Show success message and updated property state.
  - Trigger deterministic dashboard/list refresh.
- `property_mutation_conflict`
  - Show conflict state (`409 PROPERTY_STATE_CONFLICT`) with reload CTA.
  - Preserve user draft intent if action can be retried.
- `property_mutation_forbidden`
  - Show forbidden state for `403 ROLE_SCOPE_FORBIDDEN`.
  - Keep session active and disable forbidden controls.
- `property_mutation_session_expired`
  - Trigger on unrecoverable `401 TOKEN_INVALID`/`TOKEN_REVOKED`.
  - Route to `SessionExpired` with deterministic recovery CTA.
- `property_mutation_validation_error`
  - Show field/action-level validation feedback (`422 VALIDATION_ERROR`).
  - Keep screen context and allow corrective retry.

## Wave 18 Manager Auth + Property Form State Map

### Manager Auth Hardening States

- `auth_refresh_singleflight`
  - Multiple `401 TOKEN_EXPIRED` responses collapse into one refresh operation.
  - Pending requests wait for refresh result, then retry once.
- `auth_refresh_failed_hard`
  - Triggered by `TOKEN_INVALID` or `TOKEN_REVOKED` after refresh attempt.
  - Clear local session and route to `SessionExpired` with deterministic re-login CTA.
- `auth_logout_confirmed`
  - Triggered after successful logout response (or idempotent fallback).
  - Navigation resets to `Login` and no protected stack remains mounted.

### Manager Property Form States

- `property_form_idle`
  - Form rendered for create or edit mode with initial values.
- `property_form_dirty`
  - At least one field changed locally.
- `property_form_submitting`
  - Submit action in progress; submit button disabled.
- `property_form_submit_success`
  - Show success feedback and return to detail/list with refetch trigger.
- `property_form_validation_error`
  - Map `error.fields` messages to field hints.
  - Keep user input to allow corrections.
- `property_form_forbidden`
  - On `403 ROLE_SCOPE_FORBIDDEN`, disable submit and show permission message.
- `property_form_session_expired`
  - On unrecoverable `401`, route to `SessionExpired`.

### Property List/Detail Sync Rules

- After create success:
  - Return to list and trigger deterministic reload.
- After edit success:
  - Refresh both detail and list cache/snapshot.
- After validation or conflict failure:
  - Keep current editor context and avoid silent navigation.

## Wave 16 Delivery Sequencing

1. Manager contract hardening and state map (`ARCH-012`).
2. Portfolio summary/filter backend contract (`BE-014`).
3. Manager real-data wiring and session UX alignment (`MOB-013`).
4. Manager parity regression suite (`QA-015`).

## Wave 17 Delivery Sequencing

1. Property mutation contract and state map (`ARCH-013`).
2. Backend manager mutation endpoints and guards (`BE-015`).
3. Manager mutation controls wired to API (`MOB-014`).
4. Mutation regression matrix and baseline verification (`QA-016`).

## Wave 18 Delivery Sequencing

1. Auth hardening + property form contracts (`ARCH-014`).
2. Backend create/edit endpoints and validation envelope (`BE-016`).
3. Manager create/edit property form UI wiring (`MOB-015`).
4. Regression suite for auth and property forms (`QA-017`).

## Wave 19 Manager Provider Handoff State Map

### Manager Handoff Screen States

- `handoff_loading`
  - Load provider candidates for current property context.
- `handoff_ready`
  - Show provider candidates with deterministic assignment actions.
- `handoff_empty`
  - No candidates available for selected property/city/category.
- `handoff_assigning`
  - Assignment request in flight; disable duplicate actions.
- `handoff_success`
  - Show assignment confirmation and return to property detail/list with refresh.
- `handoff_validation_error`
  - Render field-level message for invalid provider selection.
- `handoff_conflict`
  - Render conflict copy and offer `Reload candidates` CTA.
- `handoff_forbidden`
  - Keep session active and show permission boundary message.
- `handoff_session_expired`
  - Route to `SessionExpired` after unrecoverable auth failure.

### Navigation Rules

- Entry points:
  - `PropertyDetail` -> `ManagerToProviderHandoff` with `propertyId`.
  - Optional quick access from dashboard if property context is provided.
- Exit rules:
  - On success, navigate back to `PropertyDetail` and trigger data refresh.
  - On hard auth failure, reset stack to auth recovery route.

## Wave 19 Delivery Sequencing

1. Handoff and assignment contract/state map (`ARCH-015`).
2. Backend provider-candidate + assignment endpoints (`BE-017`).
3. Manager handoff UI wired to API (`MOB-016`).
4. Regression matrix for assignment flow and Wave 16-18 baseline (`QA-018`).
