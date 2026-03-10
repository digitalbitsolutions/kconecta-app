# Wave 18 Plan: Manager Auth Hardening + Property Forms

## Objective

Close the manager parity gap by stabilizing auth/session behavior and delivering create/edit property forms with backend contract alignment.

## Scope

- Manager auth/session hardening:
  - login/refresh/re-auth boundaries
  - deterministic 401/403 handling
  - token refresh fallback rules
- Property create/edit lifecycle:
  - request/response contract
  - validation envelope for field-level UI feedback
  - post-mutation sync for list/detail/dashboard views
- Regression safeguards:
  - auth/session regression coverage
  - property form success/failure paths

## Agent Sequence

1. `architect`
   define contracts and UX states.
2. `backend`
   implement create/edit endpoints with validation guardrails.
3. `mobile`
   wire property form UI and mutation flows.
4. `qa`
   add regression matrix for auth and property forms.

## Risks

- Validation drift between backend and mobile form rules.
- Session refresh race conditions causing duplicated submissions.
- Stale list/detail data after successful mutation.

## Delivery Criteria

- Wave 18 issues and PRs are linked in Jira/GitHub.
- Docker-based backend tests cover create/edit and auth boundaries.
- Manager app flows are manually verified in emulator with real API responses.
