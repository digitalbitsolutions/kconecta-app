# Wave 21 - Manager Assignment Context Parity

## Goal

Expose deterministic assignment context in manager property detail flows so managers can verify who is currently assigned, when assignment happened, and what handoff note was recorded.

## Scope

- Define architecture contract for assignment context API + manager UI states.
- Add backend assignment context endpoint:
  - `GET /api/properties/{id}/assignment-context`
- Wire manager mobile property detail to consume and render assignment context.
- Expand QA regression matrix for assignment-context contract + baseline compatibility.

## Delivery Order

1. Architect contract (`ARCH-017`)
2. Backend implementation (`BE-019`)
3. Mobile wiring (`MOB-018`)
4. QA regression (`QA-020`)

## Risks

- Drift between assigned provider id in property detail and provider catalog snapshot.
- In-memory fallback path may not include provider enrichment if provider row is missing.
- UI confusion if assignment exists but provider profile is unavailable.

## Rollback Checkpoints

- Keep existing Wave 19 provider assignment endpoints unchanged.
- Add Wave 21 endpoint as additive contract (no breaking changes on existing payloads).
- Preserve deterministic auth envelope (`auth-session-v1`) for unauthorized/forbidden paths.
