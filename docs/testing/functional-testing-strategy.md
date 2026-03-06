# Functional Testing Strategy

## Purpose

Validate end-to-end functional behavior of native app API contracts before release promotion.

## Scope

- Manager app flows:
  - Properties list retrieval
  - Property detail retrieval
  - Auth behavior for valid/invalid bearer token
- Providers app flows:
  - Providers list retrieval
  - Provider detail retrieval
  - Auth behavior for valid/invalid bearer token

## Critical Flow Matrix

1. Provider mobile flow: `/api/providers` -> `/api/providers/{id}`
2. Manager mobile flow: `/api/properties` -> `/api/properties/{id}`
3. Auth control flow: invalid token -> `401` for provider/property list endpoints
4. Auth parser regression: lowercase `bearer` scheme remains accepted
5. Mobile timeout regression: client timeout value stays configurable via env and documented in release notes
6. Data-source contract: list endpoints expose `meta.source` as `database` or `in_memory`

## Execution Checklist

1. Ensure Docker services are up and API endpoint is reachable.
2. Confirm mobile token alignment:
   - `KC_MOBILE_API_TOKEN` (backend)
   - `EXPO_PUBLIC_MOBILE_API_TOKEN` (apps)
3. Run API smoke tests in QA suite.
4. Verify CI checks are green on all related PRs.
5. Record Jira evidence (PR link + test result summary).
6. Confirm `meta.source` contract in provider/property list responses.

## Entry Criteria

- Target branch synced with latest `main`.
- Required wave tasks are merged or in review.
- Token and environment variables are configured.

## Exit Criteria

- Functional smoke suite passes.
- No blocker/high defects in covered flows.
- Jira issue for testing wave is transitioned to `Done`.

## Current Automation Baseline

- API smoke tests reside under `tests/Feature/Api/*`.
- Merge pipeline enforces CI checks before orchestrator merge.
- Human approval is mandatory before merge.
