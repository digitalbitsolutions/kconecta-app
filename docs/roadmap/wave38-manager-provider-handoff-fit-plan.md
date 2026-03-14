# Wave 38 - Manager Provider Handoff Candidate Fit Parity

## Goal

Carry provider fit and scorecard signals directly into the manager handoff flow so managers can compare candidates, preserve selection context, and confirm reassignment with less navigation.

## Scope

- Architecture contract for additive handoff candidate fit preview, recommended badges, and queue-aware selection/confirmation states.
- Backend extension of `GET /api/properties/{id}/provider-candidates` with additive fit preview and recommendation metadata while preserving existing consumers.
- Manager mobile updates to render candidate fit/recommended states inside `ManagerToProviderHandoffScreen` and keep directory/profile selection context deterministic.
- QA regression coverage for candidate fit success/guardrail scenarios and baseline handoff behavior.

## Dependencies

1. Architect contract merged first.
2. Backend candidate contract and tests.
3. Mobile handoff UI against additive candidate metadata.
4. QA regression and guardrail validation.

## Risks

- Candidate fit preview can drift from provider profile scorecard if derivation rules diverge.
- Selection context can feel stale if current provider changes between directory/profile review and handoff reopen.
- Older mobile consumers must continue to work when they ignore the new candidate nodes.

## Rollback Checkpoints

- Keep the existing handoff assignment mutation contract unchanged; Wave 38 remains additive on candidate discovery and UI rendering.
- Preserve current directory/profile selection loop while introducing richer candidate cards incrementally.
- QA gates include baseline handoff and provider-directory protections before merge.
