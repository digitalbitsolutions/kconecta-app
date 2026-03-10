# Wave 20 - Manager Login and Session Parity

## Goal

Move manager app entry from env-token bootstrap to login-first runtime flow with deterministic session validation against backend auth contracts.

## Scope

- Define architecture contract for login-first bootstrap, session restore, and role/scope validation.
- Add backend session introspection endpoint for mobile runtime (`/api/auth/me`) with stable auth envelope behavior.
- Implement manager app login-first shell wiring and deterministic fallback UX for unauthorized/session-expired states.
- Expand QA matrix for login + session introspection + auth guard regressions.

## Delivery Order

1. Architect contract (`ARCH-016`)
2. Backend implementation (`BE-018`)
3. Mobile wiring (`MOB-017`)
4. QA matrix (`QA-019`)

## Risks

- Regression on existing manager dashboard load path when env bootstrap is disabled.
- Session drift between stored token and backend role/scope claims.
- Auth envelope mismatch between login/refresh/logout and new `auth/me` endpoint.

## Rollback Checkpoints

- Keep existing diagnostics path enabled during rollout.
- Guard new login-first bootstrap behind deterministic auth state resolver.
- Preserve existing auth envelope contract (`auth-session-v1`) for all error paths.
