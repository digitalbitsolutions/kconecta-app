# Native Mobile Release Notes v0.2.0 (Draft)

Draft date: 2026-03-06

## Scope in Progress

- Backend persistence alignment for provider/property read flows.
- Runtime controls to switch between DB and seed datasets.
- API observability for data source origin.

## Included in Current Increment

- Provider and property list/detail services now run in `DB-first` mode.
- Safe fallback preserved for local bootstrap when CRM tables are not present.
- New backend environment controls:
  - `KC_PROVIDER_DATA_SOURCE`
  - `KC_PROPERTY_DATA_SOURCE`
  - `KC_PROVIDER_TABLE`
  - `KC_PROPERTY_TABLE`
- List endpoint metadata now includes:
  - `meta.source = database | in_memory`
- API smoke tests updated to validate data-source metadata contract.

## Pending for v0.2.0 Final

- DB-backed create/update actions for manager/provider operational flows.
- Pagination and richer filtering aligned with CRM schema.
- End-to-end mobile auth/session lifecycle hardening.
