# Wave 36 - Manager Assignment Center Decision Rollup

- Goal: surface additive decision rollup metadata in the manager assignment center list so queue items expose latest decision state, evidence count, and next action without opening every detail screen.
- Architect: define queue-list additive contract and UX states for decision badges, evidence indicators, and recommended next action.
- Backend: extend `GET /api/properties/priorities/queue` with additive assignment decision rollup fields for provider-assignment items.
- Mobile: render decision badges and evidence indicators in `ManagerAssignmentCenterScreen` while preserving current filters and navigation.
- QA: add regression coverage for additive queue item rollup metadata and guardrails while protecting baseline queue behavior.
