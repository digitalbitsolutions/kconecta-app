# Wave 30 Plan: Manager Provider Directory and Profile Parity

## Goal

Close the next manager parity gap by exposing a manager-facing provider directory and provider profile review flow that reuses deterministic provider API contracts and existing manager auth/role recovery screens.

## Scope

- Architect: contract + state map for manager provider directory/profile flow
- Backend: provider directory/detail contract hardening for manager role
- Mobile: directory list + provider profile screens in manager app
- QA: regression matrix for directory/detail success and guardrail paths

## Guardrails

- No XAMPP
- Docker-only backend validation
- PR-only workflow to protected `main`
- Google AG for planning/review, Aider for edits, OpenClaw only as fallback

## Expected Deliverables

1. Architecture contract updates in `docs/architecture/*`
2. Backend provider list/detail contract alignment in `app/*` + `tests/Feature/Api/ProviderApiTest.php`
3. Manager mobile provider directory/profile UI flow
4. Wave 30 regression suite and QA strategy update
