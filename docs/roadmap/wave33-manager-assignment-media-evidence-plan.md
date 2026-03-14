# Wave 33 - Manager Assignment Media Evidence

## Objective

Extend the manager assignment workflow with media and document evidence so managers can attach, review, and verify assignment-specific files directly from the assignment detail flow.

## Scope

- Define the additive contract for assignment evidence upload and listing:
  - supported file categories
  - upload payload and response metadata
  - empty/loading/error states
- Harden backend support for assignment evidence endpoints with manager-only guardrails and deterministic metadata contracts.
- Add mobile manager evidence UI on assignment detail:
  - upload entry point
  - evidence list
  - upload progress and error states
- Add QA regression coverage for evidence upload/list flows plus baseline assignment detail stability.

## Deliverables

1. Architecture contract for assignment evidence media/document flows.
2. Backend endpoints/services for assignment evidence upload and retrieval metadata.
3. Mobile assignment detail evidence section wired to real API responses.
4. QA regression matrix for assignment evidence workflow and authorization guardrails.

## Ticket Plan

1. `ARCH-027` - Define Wave 33 manager assignment media evidence contract.
2. `BE-029` - Implement assignment evidence upload/list endpoints.
3. `MOB-030` - Implement assignment evidence upload UI on detail screen.
4. `QA-032` - Add assignment evidence workflow regression matrix.
