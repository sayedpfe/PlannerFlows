# Project Management Solution

A complete Project Management solution built with **Power Apps**, **SharePoint Lists**, and **PCF Controls**, replacing Planner Premium / Project Online (Schedule APIs).

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          POWER APPS CANVAS APP                          │
│  ┌──────────┐ ┌──────────┐ ┌──────┐ ┌───────┐ ┌──────────┐ ┌────────┐ │
│  │  Home /   │ │Task List │ │Gantt │ │ Board │ │ Resource │ │Dash-   │ │
│  │ Projects  │ │(Tree PCF)│ │ PCF  │ │Kanban │ │Assignment│ │board   │ │
│  └─────┬─────┘ └────┬─────┘ └──┬───┘ └───┬───┘ └────┬─────┘ └───┬────┘ │
│        └─────────────┴──────────┴─────────┴──────────┴───────────┘      │
│                     DATA LAYER (Power Fx + Collections)                  │
│         Patch() / Collect() / Power Automate .Run()                     │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                  ┌──────────────▼──────────────┐
                  │      SHAREPOINT ONLINE      │
                  │  ProjectRegistry  (1 list)  │  ← Master — all projects
                  │  Tasks_Alpha      (1/proj)  │  ← One list per project
                  │  Tasks_Beta       (1/proj)  │     (avoids 5K threshold)
                  │  ...×1000                   │
                  │  ResourceCapacity (1 list)  │  ← Cross-project rollup
                  └──────────────┬───────────────┘
                                 │
               ┌─────────────────┼─────────────────┐
     ┌─────────▼──────┐  ┌──────▼────────┐  ┌──────▼──────────┐
     │ POWER AUTOMATE  │  │ POWER AUTOMATE│  │  POWER AUTOMATE │
     │ ADO → SP (3)    │  │ SP → ADO (1)  │  │ Provision +     │
     │ Create/Update/  │  │ Reverse sync  │  │ Migrate +       │
     │ BulkSync        │  │               │  │ Aggregate (3)   │
     └────────┬────────┘  └───────┬───────┘  └─────────────────┘
              │                   │
     ┌────────▼───────────────────▼────────┐
     │          AZURE DEVOPS               │
     │  Work Item Triggers + WIQL Queries  │
     └─────────────────────────────────────┘
```

## Components

| Component | Type | Location | Status |
|-----------|------|----------|--------|
| ProjectRegistry | SharePoint List | SP site | NEW |
| Task Lists (per-project) | SharePoint List | SP site | NEW |
| ResourceCapacity | SharePoint List | SP site | NEW |
| ModernGrid v4.0 | PCF Control | `pcf-controls/ModernGrid/` | ENHANCE |
| GanttChart v1.0 | PCF Control | `pcf-controls/GanttChart/` | NEW |
| PM Canvas App | Power App | `solution/` | NEW |
| PM-ADOWorkItemCreated | Flow | `flows/` | REWRITE |
| PM-ADOWorkItemUpdated | Flow | `flows/` | REWRITE |
| PM-BulkSyncFromADO | Flow | `flows/` | REWRITE |
| PM-SyncTaskToADO | Flow | `flows/` | NEW |
| PM-CreateProjectList | Flow | `flows/` | NEW |
| PM-MigrateExistingData | Flow | `flows/` | NEW |
| PM-AggregateResourceData | Flow | `flows/` | NEW |

## Repository Structure

```
PlannerFlows/
├── README.md                          ← This file
├── .gitignore
├── OperationSet-Limit-Fix-Guide.md    ← Legacy reference
│
├── docs/                              ← Architecture & design docs
│   ├── architecture.md                ← Full solution architecture plan
│   ├── sp-list-schema.md              ← SharePoint list column specifications
│   ├── ado-field-mapping.md           ← ADO ↔ SP bidirectional field mapping
│   └── deployment-guide.md            ← Deployment instructions
│
├── pcf-controls/                      ← PCF control source code
│   ├── ModernGrid/                    ← Enhanced table with tree/hierarchy
│   ├── GanttChart/                    ← Gantt chart (wraps frappe-gantt)
│   └── Solution/                      ← PCF solution package
│
├── flows/                             ← Power Automate flow definitions
│   ├── PM-ADOWorkItemCreated.json     ← ADO → SP (work item created)
│   ├── PM-ADOWorkItemUpdated.json     ← ADO → SP (work item updated)
│   ├── PM-BulkSyncFromADO.json       ← Bulk sync from ADO query
│   ├── PM-SyncTaskToADO.json         ← SP → ADO (reverse sync)
│   ├── PM-CreateProjectList.json     ← Provision new project SP list
│   ├── PM-MigrateExistingData.json   ← One-time data migration
│   └── PM-AggregateResourceData.json ← Scheduled resource rollup
│
├── sp-templates/                      ← SharePoint list provisioning
│   ├── ProjectRegistry-columns.json
│   ├── TaskTemplate-columns.json
│   ├── ResourceCapacity-columns.json
│   └── create-lists.ps1              ← PnP PowerShell provisioning
│
├── legacy/                            ← Original PlannerFlows solution
│   └── PlannerFlows_1_0_0_3/
│
└── solution/                          ← New Power Platform solution export
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| One SP list per project | Avoids 5,000-item view threshold across 1,000 projects |
| Collection-based data binding | Canvas Apps can't dynamically bind SP lists by name |
| frappe-gantt (MIT) | Lightweight, proven, zero license cost |
| No Schedule APIs | Direct SP list writes eliminate OperationSet-OV-0004 error entirely |
| Bidirectional ADO sync | Echo prevention via LastSyncTimestamp (5-second window) |

## Getting Started

See [docs/architecture.md](docs/architecture.md) for the full implementation plan and [docs/deployment-guide.md](docs/deployment-guide.md) for setup instructions.

## License

Internal project — BASF use only.
