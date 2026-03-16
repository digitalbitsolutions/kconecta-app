# Wave 28 - Manager Auth/Session UX Hardening Plan

## Goal

Harden the manager app login and session lifecycle so it behaves like a production-facing flow instead of a dev-bootstrap flow.

## Scope

- Remove implicit reliance on prefilled bootstrap credentials in the manager login screen.
- Normalize auth/session success metadata so mobile can present deterministic session state.
- Tighten unauthorized/session-expired recovery transitions.
- Add regression coverage for login validation, invalid credentials, session restore, refresh, and role guardrails.

## Sequence

1. Architect
   - Define manager login/session UX contract, state map, and success/error envelope expectations.
2. Backend
   - Harden `auth/login`, `auth/refresh`, and `auth/me` success metadata for manager clients.
3. Mobile
   - Remove dev-first credential prefills and align login/session UX with the hardened contract.
4. QA
   - Add regression matrix for manager auth/session UX and contract stability.

## Guardrails

- Backend runtime and tests remain Docker-only.
- No XAMPP or host `php artisan test`.
- PR-only merge flow on protected `main`.
- `Aider` remains primary executor; Google AG is used for planning/review mitigation where configured.

## Expected Outputs

- Stable manager auth/session contract docs.
- Deterministic backend metadata for login, refresh, and me flows.
- Manager login/session UX that starts from a blank credential state by default.
- Regression suite covering manager auth/session recovery paths.
