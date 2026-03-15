# Wave 39 - Manager Dashboard Pending Actions Parity

- Goal: surface manager-safe pending handoff and contract actions in the dashboard so operational follow-up no longer depends on opening multiple downstream flows to discover blocked work.
- Architect: define an additive pending-actions contract, dashboard placement, state map, and navigation ownership for handoff and contract action items.
- Backend: expose a manager-authenticated pending-actions endpoint that aggregates pending handoff and contract follow-up items without breaking current dashboard consumers.
- Mobile: render a pending-actions dashboard section with tappable rows that route into the relevant handoff or contract detail surfaces while preserving current dashboard summary/priorities behavior.
- QA: add regression coverage for pending-actions success, empty, and guardrail scenarios while protecting current dashboard and handoff baselines.
