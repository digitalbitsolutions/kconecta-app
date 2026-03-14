# Wave 31 - Manager Assignment Center Parity

## Objective

Extend the manager app from one-off provider handoff flows to a dedicated assignment workspace, so managers can review assignment work items, inspect detail, and act on priority queue items without relying only on dashboard cards.

## Scope

- Define the additive contract for a manager assignment center:
  - queue list contract
  - assignment detail contract
  - action and recovery states
- Harden backend support for manager assignment operations:
  - deterministic queue item detail payload
  - stable complete/retry metadata for manager actions
  - manager-only guardrails
- Add mobile manager assignment center UI:
  - queue list screen
  - assignment detail screen
  - navigation from dashboard priorities into the assignment workspace
- Add QA regression coverage for queue list/detail/action flows and prior manager baseline protection.

## Deliverables

1. Architecture docs for assignment center API/UI contract.
2. Backend contract and endpoints for manager assignment queue detail/action evidence.
3. Mobile manager assignment center flow wired to real API data.
4. QA regression matrix and API assertions for Wave 31.

## Ticket Plan

1. `ARCH-025` - Define Wave 31 manager assignment center contract.
2. `BE-027` - Implement manager assignment center API contract.
3. `MOB-028` - Implement manager assignment center UI flow.
4. `QA-030` - Add Wave 31 manager assignment center regression matrix.
