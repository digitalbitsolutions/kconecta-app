# Multi-App Strategy

## Scope

Target delivery includes:

- Native app for real-estate managers.
- Native app for home-service providers.
- Admin operational surface with full platform access.

## Decision: Admin as Backoffice Surface (Not a Public Store App)

Decision:

- Keep admin primarily as a secured backoffice surface (web/internal app), not a public App Store/Play distribution.

Rationale:

- Admin workflows are operational and high-risk (user blocking, audit, overrides).
- Distribution through public stores adds unnecessary release friction for a small internal user base.
- Web/backoffice offers faster hotfix cadence and simpler access control.

When a native admin app would make sense:

- Field operations require offline workflows and device-native capabilities.
- Admin user base grows enough to justify dedicated mobile maintenance.

## Native App Separation

### Manager App

- Focus: property pipeline, provider matching, manager KPIs.
- Data ownership: property entities and manager actions.
- Exposed modules:
  - dashboard
  - properties list/detail
  - provider lookup (manager context only)

### Provider App

- Focus: provider profile, availability, assigned tasks.
- Data ownership: provider configuration and service operations.
- Exposed modules:
  - login/auth bootstrap
  - my profile
  - my availability editor
  - assignment queue (next wave)

Separation rule:

- Provider app must not expose cross-provider directory management as primary flow.
- Manager app must not expose provider-only edit operations.

## Shared Backend Strategy

- Single backend/API with strict role boundaries.
- Shared production database managed by backend services.
- Native apps consume the same business source via API contracts.
- No direct database access from mobile clients.

## Release Plan

1. Stabilize API contracts (`v1`) and auth boundaries.
2. Ship manager app MVP with dashboard + properties.
3. Ship provider app MVP with profile + availability.
4. Expand admin backoffice modules for audit and support workflows.

## Operational Controls

- Mandatory PR checks and human approval before merge.
- Jira issue tracking linked to each agent PR.
- Docker-based local validation to avoid machine-specific toolchains.
