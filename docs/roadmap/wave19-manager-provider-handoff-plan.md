# Wave 19 - Manager Provider Handoff Real Operations

## Goal

Deliver manager-to-provider handoff parity with CRM by replacing static handoff stubs with API-driven provider assignment flows.

## Scope

- Architecture contract for handoff queue states and assignment mutation semantics.
- Backend endpoints to fetch provider candidates and assign provider to a property with role/session guards.
- Manager mobile flow to open handoff from property detail, review candidates, and assign provider.
- QA regression matrix covering successful assignment, conflicts, forbidden role, and session-expired handling.

## Dependencies

1. Architect contract merged first.
2. Backend endpoints and tests.
3. Mobile wiring against backend contract.
4. QA regression and stability checks.

## Risks

- Stale property state after assignment if list/detail caches are not refreshed.
- Provider candidate data inconsistency between DB and in-memory fallback.
- Role guard regressions across manager/provider boundaries.

## Rollback Checkpoints

- Keep existing `ManagerToProviderHandoffScreen` route while introducing API-backed behavior incrementally.
- Backend assignment endpoint behind deterministic validation and role checks.
- QA gates include Wave 16-18 baseline protection.
