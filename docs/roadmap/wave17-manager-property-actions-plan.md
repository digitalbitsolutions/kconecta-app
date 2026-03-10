# Wave 17 Plan: Manager Property Actions

## Objective

Enable manager operational actions on properties with contract-safe backend mutations and deterministic mobile UX.

## Scope

- Manager action flows:
  - reserve property
  - release reservation
  - update operational status
- Role guardrails for `manager|admin`
- Conflict-safe response envelope for stale transitions
- Mobile action UI and post-mutation refresh
- Regression matrix for mutation and auth/session failures

## Agent Sequence

1. `architect`:
   define mutation contracts, role rules, and state transitions.
2. `backend`:
   implement API endpoints + service logic + feature tests.
3. `mobile`:
   connect manager screens to mutation APIs and state handling.
4. `qa`:
   add regression matrix and enforce guardrail coverage.

## Risks

- Concurrency collisions can produce stale UI actions if not guarded.
- Role leakage between manager/provider contexts can cause forbidden flows.
- Session expiry during mutation requires deterministic recovery path.

## Delivery Criteria

- All Wave 17 tasks have linked PRs and Jira traceability.
- Backend mutation tests pass in Docker runtime.
- Manager app mutation flows are manually verified in emulator.
