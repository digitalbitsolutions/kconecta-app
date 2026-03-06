# Mobile Release Contract

## Objective

Define the minimum environment and auth contract required for native app release candidates to consume CRM APIs in local Docker and production-compatible environments.

## Required Mobile Environment Variables

- `EXPO_PUBLIC_API_URL`
  - Base API URL used by mobile clients.
  - Local Android emulator default: `http://10.0.2.2:8000/api`
- `EXPO_PUBLIC_MOBILE_API_TOKEN`
  - Bearer token sent by mobile apps for API access.
  - Local default for development: `kconecta-dev-token`
- `EXPO_PUBLIC_APP_STAGE`
  - `local`, `staging`, `production`
- `EXPO_PUBLIC_SHOW_ENV_DIAGNOSTICS`
  - Optional debug switch (`true`/`false`) to display runtime diagnostics in non-production builds.

## Backend Environment Variable

- `KC_MOBILE_API_TOKEN`
  - Server-side expected token for mobile bearer auth.
  - Must match `EXPO_PUBLIC_MOBILE_API_TOKEN` in each environment.

## Auth Strategy (Current Increment)

- API requests are authorized when either condition is true:
  - CRM-authenticated user session exists (web/admin flows).
  - Valid bearer token matches `KC_MOBILE_API_TOKEN` (native app flows).
- Anonymous and invalid-token requests must return `401`.

## Environment Routing Guidance

- Local (Docker Desktop):
  - Mobile app -> `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api`
  - Backend token -> `KC_MOBILE_API_TOKEN=kconecta-dev-token`
- Staging/Production:
  - Mobile app points to gateway/base domain for API.
  - Token rotated per environment and stored outside source control.

## Security Notes

- Token flow is bootstrap-only for current development wave.
- Production hardening path:
  - Replace static token with short-lived JWT or OAuth flow.
  - Store credentials with platform secure storage.
  - Add endpoint-level role scopes for manager/provider/admin.

