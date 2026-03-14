# Wave 32 - Manager Assignment Status Management

## Objective

Extend the manager assignment center from read-only inspection to actionable assignment lifecycle management so managers can complete, reassign, or cancel assignment work directly from the assignment detail flow.

## Scope

- Define the additive contract for manager assignment status mutations:
  - complete
  - reassign
  - cancel
- Harden backend support for assignment mutation endpoints with deterministic guardrails and payloads.
- Add mobile actions to the assignment detail screen with immediate UI refresh.
- Add QA regression coverage for success, conflict, forbidden, unauthorized, and baseline list/detail stability.

## Deliverables

1. Architecture contract for assignment status actions and state transitions.
2. Backend endpoints/services for assignment status update workflows.
3. Mobile manager assignment detail actions wired to real API responses.
4. QA regression matrix for assignment status mutation workflow.

## Ticket Plan

1. `ARCH-026` - Define Wave 32 manager assignment status contract.
2. `BE-028` - Implement assignment status update endpoints.
3. `MOB-029` - Implement assignment status actions on detail screen.
4. `QA-031` - Add assignment status workflow regression matrix.
