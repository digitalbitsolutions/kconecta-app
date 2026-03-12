# Wave 22 - Manager Portfolio Filter and Pagination Parity Plan

## Objective

Deliver deterministic manager portfolio filtering and pagination parity between backend and native manager app so large property inventories remain navigable and contract-stable.

## Scope

- Architect:
  - Define query contract (`search`, `status`, `city`, `page`, `per_page`) and UI state map.
- Backend:
  - Enforce filter validation and pagination metadata in `/api/properties`.
- Mobile:
  - Wire property list UI with server-side filters and next-page loading semantics.
- QA:
  - Extend regression matrix for filter combinations, empty states, and pagination boundaries.

## Work Breakdown

1. `ARCH-018` (`DEV-110`)
  - Update architecture docs:
    - `docs/architecture/mobile-release-contract.md`
    - `docs/architecture/ui-ux-map.md`
    - `docs/architecture/module-map.md`
2. `BE-020` (`DEV-111`)
  - Extend backend contract:
    - status filter validation
    - deterministic `meta.total_pages`, `meta.has_next_page`
    - tests for invalid status and pagination transitions
3. `MOB-019` (`DEV-112`)
  - Add list filter controls and pagination UX in manager app.
4. `QA-021` (`DEV-113`)
  - Add wave-specific regression matrix and preserve Wave 20/21 baseline checks.

## Risk and Rollback

- Risk:
  - Filter combinations could drift between backend and mobile query composition.
  - Pagination meta mismatch could break next-page behavior.
- Rollback:
  - Revert Wave 22 deltas per-agent PR if contract regression appears.
  - Keep previous list behavior with default query path (`page=1`, no filter) as safe fallback.

## Validation Gates

- CI checks pass for each PR.
- Contract and UX docs aligned before backend/mobile merge.
- API tests cover:
  - valid filters
  - invalid status filter (`422`)
  - pagination metadata boundaries

