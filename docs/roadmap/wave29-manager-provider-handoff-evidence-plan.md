# Wave 29 - Manager Provider Handoff Evidence Hardening

## Objective

Harden the manager-to-provider handoff flow so assignment success returns enough evidence for the mobile app to confirm the outcome without requiring a second property detail fetch.

## Scope

- Define the additive contract for provider assignment success:
  - assignment snapshot
  - latest timeline event
  - deterministic `meta.contract`, `meta.flow`, `meta.reason`
- Keep manager auth/session guardrails stable for handoff routes.
- Update the manager handoff screen to:
  - render success evidence in place
  - preserve retry/error states
  - expose deterministic navigation back to property detail
- Add regression coverage for assignment evidence, forbidden/unauthorized flows, and baseline protection.

## Deliverables

1. Architecture docs for assignment evidence and UX state map.
2. Backend contract enrichment on `POST /api/properties/{id}/assign-provider`.
3. Mobile manager handoff screen consuming enriched assignment payload.
4. QA regression matrix and API assertions for Wave 29.

## Ticket Plan

1. `ARCH-023` - Define Wave 29 manager provider handoff evidence contract.
2. `BE-025` - Enrich provider assignment response with assignment evidence.
3. `MOB-026` - Harden manager handoff UX around assignment evidence and recovery.
4. `QA-028` - Add Wave 29 manager handoff regression matrix.
