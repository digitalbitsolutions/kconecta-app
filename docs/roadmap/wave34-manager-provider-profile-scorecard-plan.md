# Wave 34 - Manager Provider Profile Scorecard Parity

## Goal

Extend the manager provider-evaluation flow so reassignment decisions can be made from a provider profile with assignment-aware fit signals, additive scorecard metadata, and deterministic fallback states.

## Scope

1. Architect
- Define additive `assignment_fit` contract for manager provider profile requests.
- Document `queue_item_id`-aware provider profile behavior.
- Map UI states for recommended, warning, unavailable, unauthorized, and session-expired profile flows.

2. Backend
- Extend `GET /api/providers/{id}` with optional `queue_item_id` context for manager role.
- Return additive provider scorecard fields without breaking existing provider profile payload.
- Preserve current provider directory/profile baseline for requests without queue context.

3. Mobile
- Allow opening provider profile from assignment selection flow with `queue_item_id` context.
- Render scorecard/fit insights and enable provider selection directly from the profile screen.
- Keep generic directory browsing intact when no assignment context is present.

4. QA
- Add regression coverage for profile scorecard success, missing queue item, forbidden role, invalid token, and baseline profile behavior without queue context.

## Contracts

### Provider Profile Additive Contract
- Endpoint: `GET /api/providers/{id}?queue_item_id={queueItemId}`
- Additive `data.assignment_fit` object:
  - `recommended: boolean`
  - `score_label: string`
  - `match_reasons: string[]`
  - `warnings: string[]`
  - `next_action: string | null`
- Existing profile fields remain unchanged.

### Guardrails
- Invalid token: `401 TOKEN_INVALID`
- Role mismatch: `403 ROLE_SCOPE_FORBIDDEN`
- Unknown provider: `404 PROVIDER_NOT_FOUND`
- Unknown queue item context: `404 QUEUE_ITEM_NOT_FOUND`
- Missing `queue_item_id` keeps baseline provider profile contract stable.

## Ticket Mapping

1. `DEV-169` epic placeholder -> Wave 34 orchestration and rollout tracking.
2. `DEV-170` / `ARCH-028` -> Provider profile scorecard contract + UX state map.
3. `DEV-171` / `BE-030` -> Assignment-aware provider profile backend contract.
4. `DEV-172` / `MOB-031` -> Provider profile scorecard UI + select-from-profile flow.
5. `DEV-173` / `QA-021` -> Regression matrix for provider profile scorecard workflow.
