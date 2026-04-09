# Flows

Power Automate flow definitions (JSON exports).

Export each flow from `make.powerautomate.com` and save the JSON definition here.

## Flow Inventory

| Flow | Trigger | Purpose |
|------|---------|---------|
| PM-ADOWorkItemCreated | ADO WI Created (1min) | Create SP list item from ADO |
| PM-ADOWorkItemUpdated | ADO WI Updated (1min) | Update SP list item from ADO |
| PM-BulkSyncFromADO | Power App button | Bulk ADO query → SP |
| PM-SyncTaskToADO | SP item modified | Reverse sync to ADO |
| PM-CreateProjectList | Power App button | Provision new project SP list |
| PM-MigrateExistingData | Manual (one-time) | Migrate legacy SP list data |
| PM-AggregateResourceData | Scheduled daily | Cross-project resource rollup |

See [docs/architecture.md](../docs/architecture.md) sections 8.1–8.7 for flow specifications.
