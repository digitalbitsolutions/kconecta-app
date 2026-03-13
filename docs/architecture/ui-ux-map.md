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

## Wave 20 Manager Login-First Session State Map

### App Entry and Session Bootstrap States

- `entry_bootstrap_check`
  - App starts and checks persisted session token.
- `entry_login_required`
  - No valid session token; route to `Login`.
- `entry_session_validating`
  - Token exists; call `GET /api/auth/me` before mounting manager shell.
- `entry_session_valid`
  - Session claims accepted; route to manager dashboard stack.
- `entry_session_expired`
  - Refresh attempt failed or token invalid; route to `SessionExpired`.
- `entry_unauthorized_role`
  - Authenticated token not in manager/admin scope; route to `Unauthorized`.

### Login Screen States

- `login_idle`
  - Inputs enabled; submit available.
- `login_submitting`
  - Disable duplicate submits while request is in flight.
- `login_success`
  - Persist tokens; transition to `entry_session_validating`.
- `login_error_invalid_credentials`
  - Show deterministic invalid credentials feedback.
- `login_error_transport`
  - Show retryable network/system feedback with retry CTA.

### Runtime Session Guard States

- `runtime_refreshing`
  - Single refresh owner handles concurrent `401 TOKEN_EXPIRED` responses.
- `runtime_refresh_failed`
  - Clear session and reset navigation to `SessionExpired`.
- `runtime_scope_forbidden`
  - Keep session active and route user to `Unauthorized`.

## Wave 20 Delivery Sequencing

1. Login-first and auth/me state contract (`ARCH-016`).
2. Backend auth/me endpoint and session envelope parity (`BE-018`).
3. Manager login-first bootstrap wiring (`MOB-017`).
4. Regression matrix for login/session parity and Wave 16-19 baseline (`QA-019`).

## Wave 21 Manager Assignment Context State Map

### Property Detail Assignment Context States

- `assignment_context_loading`
  - Fetch assignment context after property detail is loaded.
  - Keep property details visible while assignment card is resolving.
- `assignment_context_ready`
  - Render provider snapshot and assignment metadata (`assigned_at`, `note`).
- `assignment_context_unassigned`
  - Render deterministic empty state with CTA to open provider handoff.
- `assignment_context_provider_missing`
  - Show warning state when property references provider id that no longer resolves in provider catalog.
  - Keep mutation controls available for reassignment.
- `assignment_context_error`
  - Show retry CTA without leaving property detail screen.
- `assignment_context_forbidden`
  - Route to `Unauthorized` preserving deterministic manager auth behavior.
- `assignment_context_session_expired`
  - Route to `SessionExpired` after unrecoverable auth failure.

### Handoff Refresh Rule

- After successful `assign-provider` mutation:
  - Navigate back to property detail.
  - Trigger assignment-context reload.
  - Keep success feedback deterministic (`assigned` state + provider summary).

## Wave 21 Delivery Sequencing

1. Assignment-context contract and state map (`ARCH-017`).
2. Backend assignment-context endpoint (`BE-019`).
3. Manager property detail assignment-context wiring (`MOB-018`).
4. Assignment-context regression matrix and Wave 19-20 baseline checks (`QA-020`).

## Wave 22 Manager Portfolio Filter/Pagination State Map

### Property List States (Extended)

- `list_loading_initial`
  - First portfolio fetch with default filters.
- `list_filter_applying`
  - Filter/search update in progress; keep previous list visible with lightweight loading indicator.
- `list_ready`
  - Render rows with applied filters and pagination footer.
- `list_empty_filtered`
  - No results for current filter/search combination; provide `Clear filters` CTA.
- `list_paginating`
  - Next page in flight; keep current page visible.
- `list_pagination_end`
  - Reached last page; hide/disable next-page action.
- `list_error_retryable`
  - Deterministic error with `Retry` CTA preserving current filters.

### UX Rules

- Filter controls must be deterministic:
  - `status` single-select
  - `city` text/select
  - `search` free text
- Clear-filter action resets to default query (`page=1`, no filters).
- Pagination transition must reset to first page whenever filters/search change.

## Wave 22 Delivery Sequencing

1. Portfolio filter/pagination contract and state map (`ARCH-018`).
2. Backend filters + pagination metadata implementation (`BE-020`).
3. Manager property list filter/pagination UI wiring (`MOB-019`).
4. Regression matrix for filters/pagination and Wave 20-21 baseline (`QA-021`).

## Wave 23 Manager Property Timeline State Map

### Property Detail Timeline States

- `detail_timeline_loading`
  - Timeline request in progress after detail payload loads.
  - Keep property summary visible.
- `detail_timeline_ready`
  - Render timeline events in descending chronological order.
- `detail_timeline_empty`
  - Render deterministic empty-history state.
- `detail_timeline_refreshing`
  - Non-blocking refresh after assignment/mutation action.
- `detail_timeline_error`
  - Show retry CTA preserving current property context.
- `detail_timeline_forbidden`
  - Route to unauthorized state while session remains authenticated.
- `detail_timeline_session_expired`
  - Route to `SessionExpired` on unrecoverable `401`.

### Handoff-to-Detail Timeline Rules

- After successful assign-provider mutation:
  - Return to property detail and trigger timeline refresh.
  - The latest event should represent assignment mutation outcome.
- Status mutation flow must append deterministic timeline event after successful mutation.
- Empty timeline must not block property detail usage.

## Wave 23 Delivery Sequencing

1. Timeline contract/state map (`ARCH-019`).
2. Backend timeline payload implementation (`BE-021`).
3. Manager detail/handoff timeline UI wiring (`MOB-020`).
4. Regression matrix for timeline parity and Wave 20-22 baseline (`QA-022`).

## Wave 24 Manager Dashboard Summary and Priorities State Map

### Dashboard Summary States

- `dashboard_summary_loading`
  - Initial dashboard summary request in flight.
  - KPI cards and priorities panel render deterministic skeleton placeholders.
- `dashboard_summary_ready`
  - Render `data.kpis` and ordered `data.priorities[]` from contract.
- `dashboard_summary_refreshing`
  - Pull-to-refresh or explicit retry keeps previous data visible.
  - Show non-blocking refresh indicator.
- `dashboard_summary_empty_priorities`
  - KPI block remains visible.
  - Priorities panel shows deterministic empty state copy.
- `dashboard_summary_error_fallback`
  - If request fails and no snapshot exists, render deterministic fallback state with retry CTA.
  - If snapshot exists, preserve stale snapshot + show non-blocking error banner.

### Dashboard Interaction Rules

- Priorities ordering must follow backend taxonomy contract:
  - `severity` descending, then `due_at`, then `updated_at`.
- Refresh action never clears current UI state before receiving new payload.
- Empty priorities is not treated as error if KPI block is valid.

### Wave 24 Delivery Sequencing

1. Dashboard summary/priorities contract and state map (`ARCH-020`).
2. Backend summary/priorities payload implementation (`BE-022`).
3. Manager dashboard/priorities UI wiring (`MOB-021`).
4. Regression matrix for dashboard summary and priorities parity (`QA-023`).

## Wave 25 Manager Priority Queue State Map

### Dashboard Priority Queue States

- `priority_queue_loading`
  - Queue request in flight after dashboard shell is ready.
  - Keep KPI block visible while queue resolves.
- `priority_queue_ready`
  - Render ordered queue items with severity and SLA badges.
- `priority_queue_empty`
  - Deterministic empty state with CTA to open full portfolio list.
- `priority_queue_refreshing`
  - Pull-to-refresh keeps current queue snapshot visible.
  - Show non-blocking refresh indicator.
- `priority_queue_error_fallback`
  - If queue fails and no snapshot exists, render retry state.
  - If snapshot exists, keep stale snapshot and show non-blocking error banner.
- `priority_queue_filtering`
  - Category/severity filter change keeps prior data visible until new payload arrives.
- `priority_queue_unauthorized`
  - On `403 ROLE_SCOPE_FORBIDDEN`, route to unauthorized state while session remains active.
- `priority_queue_session_expired`
  - On unrecoverable `401`, route to `SessionExpired`.

### Queue Interaction Rules

- Queue item action is deterministic per `action` field:
  - `open_property` -> navigate `PropertyDetail`
  - `open_handoff` -> navigate `ManagerToProviderHandoff`
  - `review_status` -> navigate `PropertyList` with pre-applied status filter
- Queue ordering displayed in UI must preserve backend order.
- Refresh action never clears visible queue before new payload response.

### Wave 25 Delivery Sequencing

1. Priority queue contract and state map (`ARCH-021`).
2. Backend queue endpoint and ordering guarantees (`BE-023`).
3. Manager dashboard queue wiring (`MOB-022`).
4. Regression matrix for queue/SLA parity (`QA-024`).

## Wave 26 Manager Queue Action Completion State Map

### Queue Completion Mutation States

- `queue_action_idle`
  - Queue row displays deterministic CTA from backend `action` hint.
- `queue_action_submitting`
  - Selected queue item enters local busy state.
  - Row-level CTA is disabled while preserving global dashboard interactivity.
- `queue_action_success`
  - Queue row updates to completed state with completion timestamp.
  - Optional optimistic removal from active list if completion filter excludes resolved items.
- `queue_action_conflict`
  - On `409 QUEUE_ACTION_CONFLICT`, row displays deterministic conflict banner with refresh CTA.
- `queue_action_validation_error`
  - On `422 VALIDATION_ERROR`, show inline validation copy for completion note/code.
- `queue_action_unauthorized`
  - On `403 ROLE_SCOPE_FORBIDDEN`, route to existing unauthorized state shell.
- `queue_action_session_expired`
  - On unrecoverable `401`, route to `SessionExpired`.

### Queue Completion Interaction Rules

- Completion action is item-scoped; other queue rows remain interactive.
- `queue_action_submitting` must not block pull-to-refresh for the full dashboard.
- If optimistic completion fails, row returns to previous deterministic state with error context.
- Success state emits local analytics event for manager queue throughput metrics.

### Wave 26 Delivery Sequencing

1. Queue completion mutation contract and UX state map (`ARCH-016`).
2. Backend queue completion endpoint and deterministic guardrails (`BE-021`).
3. Manager dashboard queue completion wiring (`MOB-023`).
4. Regression matrix for queue completion + cross-wave baseline safety (`QA-025`).

## Wave 27 Manager Property Form Parity State Map

### Property Form Screen States

- `property_form_create_idle`
  - Empty create form with deterministic defaults for `status` and `operation_mode`.
- `property_form_edit_loading`
  - Existing property payload is loading before edit inputs become interactive.
- `property_form_edit_ready`
  - Existing property payload is mapped into grouped editor sections.
- `property_form_submitting`
  - Save mutation in flight; submit CTA disabled while inputs remain visible.
- `property_form_validation_error`
  - Inline field errors rendered from `error.fields` without clearing current inputs.
- `property_form_conflict`
  - On `409 PROPERTY_FORM_CONFLICT`, show retry/reload CTA while preserving user draft snapshot.
- `property_form_save_success`
  - Navigate deterministically to `PropertyDetail` with refreshed property context.
- `property_form_unauthorized`
  - On `403 ROLE_SCOPE_FORBIDDEN`, route to existing unauthorized shell.
- `property_form_session_expired`
  - On unrecoverable `401`, route to `SessionExpired`.
- `property_form_load_error`
  - Edit flow failed to load existing property; show deterministic retry state.

### Field Taxonomy and UX Grouping

- `identity_section`
  - `title`
  - `description`
- `location_section`
  - `address`
  - `city`
  - `postal_code`
- `commercial_section`
  - `property_type`
  - `operation_mode`
  - `status`
- `pricing_section`
  - `sale_price`
  - `rental_price`
  - `garage_price_category_id`
  - `garage_price`
- `characteristics_section`
  - `bedrooms`
  - `bathrooms`
  - `rooms`
  - `elevator`

### Form Interaction Rules

- Edit and create flows share the same canonical field taxonomy.
- Conditional fields must remain deterministic:
  - hide or disable `sale_price` when `operation_mode = rent`
  - hide or disable `rental_price` when `operation_mode = sale`
  - require/show garage pricing only for garage-capable property types
  - require/show residential counters only for residential property types
- Validation errors must map one-to-one to visible inputs and never collapse unrelated sections.
- Successful save routes to `PropertyDetail`; create flow must not return to stale form screen.
- Conflict state preserves local form draft until user explicitly reloads.

### Create/Edit Transition Rules

- `property_form_create_idle -> property_form_submitting`
  - on save attempt with locally valid input.
- `property_form_edit_loading -> property_form_edit_ready`
  - after property payload resolves successfully.
- `property_form_submitting -> property_form_validation_error`
  - on `422 VALIDATION_ERROR`.
- `property_form_submitting -> property_form_conflict`
  - on `409 PROPERTY_FORM_CONFLICT`.
- `property_form_submitting -> property_form_unauthorized`
  - on `403 ROLE_SCOPE_FORBIDDEN`.
- `property_form_submitting -> property_form_session_expired`
  - on unrecoverable `401`.
- `property_form_submitting -> property_form_save_success`
  - on create/update success.
- `property_form_edit_loading -> property_form_load_error`
  - on deterministic load failure not caused by session expiry.

### Wave 27 Delivery Sequencing

1. Property form parity contract and UX state map (`ARCH-021`).
2. Backend enriched property create/edit payload implementation (`BE-023`).
3. Manager property create/edit UI parity wiring (`MOB-024`).
4. Regression matrix for enriched property form parity (`QA-026`).

## Wave 28 Manager Auth/Session UX State Map

### Login Screen States

- `manager_login_idle`
  - Email/password fields empty by default.
  - Explicit local bootstrap values may prefill only when configured intentionally.
- `manager_login_validation_error`
  - Missing/invalid input is rejected before shell transition.
  - Field-level copy stays attached to `email`/`password`.
- `manager_login_submitting`
  - Disable duplicate submit and keep current screen context.
- `manager_login_invalid_credentials`
  - API returned `401 INVALID_CREDENTIALS`.
  - Preserve email field and prompt retry.
- `manager_login_transport_error`
  - Network/system failure with retryable copy.
- `manager_login_success`
  - Persist session tokens and transition into session restore validation.

### Session Restore and Guard States

- `manager_session_restore_pending`
  - Persisted token exists; app calls `GET /api/auth/me`.
- `manager_session_refresh_pending`
  - First `401 TOKEN_EXPIRED` triggers one refresh path.
- `manager_session_ready`
  - Session resolved with manager/admin role; route to dashboard shell.
- `manager_session_unauthorized`
  - `403 ROLE_SCOPE_FORBIDDEN`; route to `Unauthorized`.
- `manager_session_expired`
  - Unrecoverable auth failure; route to `SessionExpired`.

### Recovery Rules

- `Unauthorized`
  - Keep deterministic recovery CTA back to `Login`.
  - Never leave stale protected screens mounted.
- `SessionExpired`
  - Hard-clears session snapshot.
  - Primary CTA returns to `Login`.
- Diagnostics visibility:
  - local/staging may show stage + API context
  - production login surface must not depend on diagnostic banners to complete auth flow

### Wave 28 Delivery Sequencing

1. Auth/session UX hardening contract (`ARCH-022`).
2. Backend auth success metadata hardening (`BE-024`).
3. Manager login/session UX hardening (`MOB-025`).
4. Regression matrix for manager auth/session UX (`QA-027`).

## Wave 29 Manager Handoff Evidence State Map

### Manager Handoff States

- `handoff_loading`
  - Load provider candidates for current property context.
- `handoff_ready`
  - Show provider candidates and optional assignment note input.
- `handoff_assigning`
  - Assignment mutation in flight; disable duplicate submit.
- `handoff_success_evidence_ready`
  - Render provider snapshot, assigned timestamp, note, and latest assignment event directly from assignment success payload.
  - Allow deterministic CTA back to property detail.
- `handoff_success_navigation_pending`
  - Success evidence already rendered locally.
  - Property detail refresh is scheduled after navigation, but success confirmation does not depend on it.
- `handoff_validation_error`
  - Keep selected provider and note input.
  - Show deterministic validation copy.
- `handoff_conflict`
  - Preserve current context and show reload/retry CTA.
- `handoff_forbidden`
  - Route to `Unauthorized` while keeping auth state explicit.
- `handoff_session_expired`
  - Route to `SessionExpired` after unrecoverable auth failure.
- `handoff_transport_error`
  - Keep current screen context and allow retry without clearing local note input.

### Wave 29 Interaction Rules

- Assignment success must no longer depend on a follow-up `PropertyDetail` fetch to show evidence.
- Success surface minimum evidence:
  - assigned provider identity
  - assigned timestamp
  - assignment note (if present)
  - latest assignment timeline event summary
- Navigation rule:
  - user may return to property detail immediately after success evidence is rendered.
  - property detail then performs its own non-blocking refresh for long-lived consistency.
- Recovery rule:
  - conflict/validation/transport failures keep the handoff route mounted and preserve current draft inputs.

### Wave 29 Delivery Sequencing

1. Assignment evidence contract and state map (`ARCH-023`).
2. Backend assignment evidence payload enrichment (`BE-025`).
3. Manager handoff evidence UX wiring (`MOB-026`).
4. Regression matrix for assignment evidence and recovery (`QA-028`).
