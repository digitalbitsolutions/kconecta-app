# Wave 37 - Manager Provider Directory and Scorecard Parity

- Goal: expose a manager-facing provider directory and provider profile scorecard so assignment and property operations can review providers without relying on inline candidate cards only.
- Architect: define additive contract and UX states for searchable provider directory rows, provider profile scorecards, and navigation entry points from dashboard and handoff flows.
- Backend: extend `GET /api/providers` and `GET /api/providers/{id}` with manager-safe filters plus additive scorecard/profile metadata while preserving existing consumers.
- Mobile: add manager provider directory/profile screens and wire navigation from dashboard and handoff contexts without breaking current assignment flows.
- QA: add regression coverage for provider directory filters, profile scorecard payloads, and manager-role guardrails.
