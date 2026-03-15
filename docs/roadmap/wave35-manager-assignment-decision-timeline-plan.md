# Wave 35 - Manager assignment decision timeline parity

## Goal

Make the manager assignment detail flow more operational by exposing a concise decision summary and richer timeline semantics without breaking the existing assignment detail contract.

## Scope

- Architect:
  - define additive decision-summary and timeline metadata for manager assignment detail
  - document UI states for completed, reassigned, cancelled, and evidence-backed decisions
- Backend:
  - extend queue assignment detail payload with additive decision summary and timeline metadata
  - preserve current contract for consumers that only rely on the existing fields
- Mobile:
  - render decision summary card and richer timeline rows in assignment detail
  - surface evidence-backed decision context without changing current action flow
- QA:
  - add regression coverage for additive decision summary and timeline guardrails

## Expected Outcome

Managers can open an assignment and immediately understand:

- current decision state
- latest provider decision context
- whether evidence exists for the current assignment
- which timeline events matter for reassignment, completion, or cancellation

## Delivery Notes

- Keep the backend contract additive.
- Keep mobile state transitions simple and deterministic.
- Avoid broad task scopes to reduce Aider timeout risk.
- Use Google AG for planning/review, Aider for scoped edits, and OpenClaw only as fallback.
