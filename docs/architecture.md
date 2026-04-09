# Solution Architecture — Project Management with Power Apps + SharePoint

> **Version:** 1.0 | **Date:** 2026-04-09 | **Status:** Planning

## TL;DR

Build a complete Project Management solution replacing Planner Premium / Project Online (Schedule APIs) with Power Apps + SharePoint Lists. Monorepo at `sayedpfe/PlannerFlows` with child folders for PCF controls, flows, SP schema, and documentation. One SP list per project (avoids 5K threshold across 1,000 projects). Two custom PCF controls (ModernGrid enhanced + Gantt). 6 Power App screens. Bidirectional ADO sync. Cross-project resource capacity.

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          POWER APPS CANVAS APP                               │
│  ┌──────────┐ ┌──────────┐ ┌──────┐ ┌───────┐ ┌──────────┐ ┌───────────┐  │
│  │  Home /   │ │Task List │ │Gantt │ │ Board │ │ Resource │ │ Dashboard │  │
│  │ Projects  │ │(Tree PCF)│ │ PCF  │ │Kanban │ │Assignment│ │  Charts   │  │
│  └─────┬─────┘ └────┬─────┘ └──┬───┘ └───┬───┘ └────┬─────┘ └─────┬─────┘  │
│        │             │          │         │          │             │          │
│  ┌─────▼─────────────▼──────────▼─────────▼──────────▼─────────────▼──────┐  │
│  │                     DATA LAYER (Power Fx)                              │  │
│  │  • Dynamic SP list binding per project (via collections)              │  │
│  │  • Patch() / Collect() / LookUp() / Filter()                         │  │
│  │  • Power Automate .Run() for provisioning & sync                      │  │
│  └────────────────────────────┬───────────────────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │      SHAREPOINT ONLINE      │
                 │  basf.sharepoint.com/sites/ │
                 │  ngba-gb-planner-projects   │
                 │                              │
                 │  ┌────────────────────────┐  │
                 │  │   ProjectRegistry      │  │  ← Master list of all projects
                 │  │   (1 list, ~1000 rows) │  │
                 │  └────────────────────────┘  │
                 │                              │
                 │  ┌────────────────────────┐  │
                 │  │  Tasks_ProjectAlpha    │  │  ← Per-project task list
                 │  │  Tasks_ProjectBeta     │  │     (one list per project)
                 │  │  Tasks_ProjectGamma    │  │     each < 5000 items
                 │  │  ...                   │  │
                 │  └────────────────────────┘  │
                 │                              │
                 │  ┌────────────────────────┐  │
                 │  │  ResourceCapacity      │  │  ← Cross-project aggregation
                 │  │  (1 list)              │  │
                 │  └────────────────────────┘  │
                 └──────────────┬───────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                   │
    ┌─────────▼──────┐  ┌──────▼────────┐  ┌──────▼────────────┐
    │  POWER AUTOMATE │  │ POWER AUTOMATE│  │  POWER AUTOMATE   │
    │  ADO → SP Sync  │  │ SP → ADO Sync │  │  Provisioning &   │
    │  (3 flows)      │  │ (1 flow)      │  │  Aggregation      │
    │                 │  │               │  │  (3 flows)        │
    └────────┬────────┘  └───────┬───────┘  └───────────────────┘
             │                   │
    ┌────────▼───────────────────▼────────┐
    │          AZURE DEVOPS              │
    │  • Work Item Triggers (polling)    │
    │  • WIQL Queries (bulk sync)        │
    │  • Work Item Update API            │
    └────────────────────────────────────┘
```

## 2. Component Inventory

| Component | Type | Location | Status |
|-----------|------|----------|--------|
| ProjectRegistry SP List | SharePoint | SP site | NEW |
| TaskTemplate SP List | SharePoint | SP site | NEW |
| ResourceCapacity SP List | SharePoint | SP site | NEW |
| ModernGrid PCF v4.0 | PCF Control | `pcf-controls/ModernGrid/` | ENHANCE (from v3.6) |
| GanttChart PCF v1.0 | PCF Control | `pcf-controls/GanttChart/` | NEW |
| PM Canvas App | Power App | `solution/` | NEW (replaces paloma_plannermasterapp) |
| PM-ADOWorkItemCreated | Flow | `flows/` | REWRITE (from 2PLANNER-*) |
| PM-ADOWorkItemUpdated | Flow | `flows/` | REWRITE (from 3PLANNER-*) |
| PM-BulkSyncFromADO | Flow | `flows/` | REWRITE (from PlannerDevOpsIntegration-Sync) |
| PM-SyncTaskToADO | Flow | `flows/` | NEW |
| PM-CreateProjectList | Flow | `flows/` | NEW |
| PM-MigrateExistingData | Flow | `flows/` | NEW |
| PM-AggregateResourceData | Flow | `flows/` | NEW |
| PCF Solution Package | Solution | `pcf-controls/Solution/` | NEW |
| PA Solution Package | Solution | `solution/` | ENHANCE |

---

## 3. Repository Structure

```
PlannerFlows/                                    ← GitHub: sayedpfe/PlannerFlows
│
├── README.md                                    ← Project overview, architecture diagrams
├── .gitignore                                   ← Updated for all sub-projects
├── OperationSet-Limit-Fix-Guide.md              ← Legacy doc (keep for reference)
│
├── docs/                                        ← Documentation
│   ├── architecture.md                          ← Solution architecture (this file)
│   ├── sp-list-schema.md                        ← SharePoint list column specs
│   ├── ado-field-mapping.md                     ← ADO ↔ SP field mapping reference
│   └── deployment-guide.md                      ← Step-by-step deployment instructions
│
├── pcf-controls/                                ← All PCF controls
│   ├── ModernGrid/                              ← Enhanced table with tree/hierarchy
│   │   ├── ResourceAssignmentTable/             ← PCF control source
│   │   │   ├── ControlManifest.Input.xml
│   │   │   ├── index.ts
│   │   │   ├── components/
│   │   │   │   ├── ResourceTable.tsx
│   │   │   │   ├── TreeChevron.tsx              ← NEW
│   │   │   │   ├── ResizableHeader.tsx
│   │   │   │   ├── MultiSelectDropdown.tsx
│   │   │   │   ├── FilterPopover.tsx
│   │   │   │   ├── EditableCell.tsx
│   │   │   │   ├── ResourceChip.tsx
│   │   │   │   └── ErrorBoundary.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useTreeState.ts              ← NEW
│   │   │   │   ├── useColumnResize.ts
│   │   │   │   └── useSortFilter.ts
│   │   │   ├── utils/
│   │   │   │   ├── treeUtils.ts                 ← NEW
│   │   │   │   ├── types.ts
│   │   │   │   └── helpers.ts
│   │   │   └── css/ModernTable.css
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── ModernTable.pcfproj
│   │
│   ├── GanttChart/                              ← NEW: Gantt PCF control
│   │   ├── GanttChart/
│   │   │   ├── ControlManifest.Input.xml
│   │   │   ├── index.ts
│   │   │   ├── components/
│   │   │   │   ├── GanttView.tsx
│   │   │   │   └── GanttToolbar.tsx
│   │   │   ├── utils/
│   │   │   │   ├── taskMapper.ts
│   │   │   │   └── types.ts
│   │   │   └── css/GanttChart.css
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── GanttChart.pcfproj
│   │
│   └── Solution/                                ← PCF Solution package
│       ├── src/Other/Solution.xml
│       └── Solution.cdsproj
│
├── flows/                                       ← Flow definitions (JSON exports)
│   ├── PM-ADOWorkItemCreated.json
│   ├── PM-ADOWorkItemUpdated.json
│   ├── PM-BulkSyncFromADO.json
│   ├── PM-SyncTaskToADO.json
│   ├── PM-CreateProjectList.json
│   ├── PM-MigrateExistingData.json
│   └── PM-AggregateResourceData.json
│
├── sp-templates/                                ← SharePoint list provisioning
│   ├── ProjectRegistry-columns.json
│   ├── TaskTemplate-columns.json
│   ├── ResourceCapacity-columns.json
│   └── create-lists.ps1
│
├── legacy/                                      ← Original PlannerFlows solution
│   └── PlannerFlows_1_0_0_3/
│       ├── [Content_Types].xml
│       ├── customizations.xml
│       ├── solution.xml
│       ├── CanvasApps/
│       └── Workflows/ (23 original flow JSONs)
│
└── solution/                                    ← New Power Platform solution export
    ├── [Content_Types].xml
    ├── customizations.xml
    ├── solution.xml
    ├── CanvasApps/
    └── Workflows/
```

---

## 4. SharePoint List Schema

> Full column specifications are in [sp-list-schema.md](sp-list-schema.md)

### 4.1 ProjectRegistry (Master List — 13 columns)

Single registry of all projects. Power App home screen data source.

Key columns: Title, ProjectListName, ADO_Project, ADO_AreaPath, ADO_Iteration, ADO_QueryId, Owner, ProjectStatus, StartDate, EndDate, BucketDefinitions, TaskCount.

### 4.2 Task List Template (Per-Project — 26 columns)

One list per project, named `Tasks_{ProjectName}`. Replaces both the SP tracking list AND Project Online `msdyn_projecttask`.

Key columns: Title, OutlineLevel, ParentTaskId, SortOrder, PSP, PercentComplete, Priority, Status, Bucket, Start, EndDate, Duration, Predecessor, AssignedTo, ADO_ID, ADO_State, LastSyncTimestamp.

**Indexed columns (7):** Title, OutlineLevel, ParentTaskId, Status, Bucket, ADO_ID, ADO_AreaPath

### 4.3 ResourceCapacity (Cross-Project Aggregation — 11 columns)

Aggregated resource data populated by daily scheduled flow. Key columns: PersonName, PersonEmail, ProjectName, TaskCount, TotalDuration, AvgPercentComplete.

---

## 5. PCF Control: ModernGrid v4.0

### 5.1 New Manifest Properties

```
NEW INPUT PROPERTIES:
  outlineLevelColumn    SingleLine.Text    "Column name containing OutlineLevel number"
  parentIdColumn        SingleLine.Text    "Column name containing parent item ID"
  sortOrderColumn       SingleLine.Text    "Column name for sibling sort order"
  enableSelection       TwoOptions         "Show row selection checkboxes" (default: false)
  enableInlineCreate    TwoOptions         "Show add-task row at bottom" (default: false)
  percentColumnName     SingleLine.Text    "Column name for percent-complete progress bar"

NEW OUTPUT PROPERTIES:
  selectedItems         SingleLine.Text    "JSON array of selected row IDs"
  onTaskCreate          SingleLine.Text    "JSON: {parentId, title, outlineLevel, sortOrder}"

VERSION BUMP: 3.6.0 → 4.0.0
```

### 5.2 New CellType: `percent`

**File:** `utils/types.ts`
- Add `"percent"` to `CellType` union type
- `getDefaultWidth("percent")` → 130, `getMinWidth("percent")` → 90

**File:** `components/ResourceTable.tsx` → `renderCell()` → new `case "percent"`:

```
Render:
  <div class="progress-bar-outer">  (gray bg, 16px height, rounded-full)
    <div class="progress-bar-fill" style="width: {value}%">  (colored fill)
      <span class="progress-bar-text">{value}%</span>
    </div>
  </div>

Color logic:
  0-33%  → #ef4444 (red)
  34-66% → #f59e0b (amber)
  67-99% → #3b82f6 (blue)
  100%   → #16a34a (green)
```

### 5.3 Tree/Hierarchy Implementation

#### New File: `utils/treeUtils.ts`

```typescript
interface ITreeNode {
  row: IRow;
  depth: number;
  hasChildren: boolean;
  parentId: string | null;
}

function buildTreeOrder(rows, outlineLevelKey, parentIdKey, sortOrderKey): ITreeNode[]
// Algorithm:
//   1. Group rows by parentId
//   2. Sort each group by sortOrder
//   3. DFS traversal: emit parent, then children recursively
//   4. Mark hasChildren = childMap.has(row.id)

function filterVisibleRows(treeNodes, expandedSet): ITreeNode[]
// Algorithm:
//   Walk treeNodes in order
//   Track "collapsed ancestors" stack
//   If current node's parent is collapsed → skip
//   Root nodes always visible
```

#### New File: `hooks/useTreeState.ts`

```typescript
function useTreeState(storageKey: string): {
  expandedIds: Set<string>;
  toggleExpand: (rowId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  isExpanded: (rowId: string) => boolean;
}
// Default: all expanded
// Persist collapsed IDs to localStorage: "pcf_tree_state_{storageKey}"
```

#### New File: `components/TreeChevron.tsx`

```typescript
Props: { isExpanded: boolean; hasChildren: boolean; depth: number; onToggle: () => void }
Render:
  <span style="paddingLeft: depth * 24px">
    {hasChildren ? (isExpanded ? "▼" : "▶") : "·"}
  </span>
```

#### Modify: `components/ResourceTable.tsx`

Data pipeline change:
```
BEFORE: applySearch → applyFilters → applySorting → render
AFTER:  applySearch → applyFilters → buildTreeOrder → filterVisibleRows → render
```
(Tree mode disables custom sorting — tree order IS the sort order)

First column rendering:
- Prepend `<TreeChevron>` before cell content
- Apply `paddingLeft: depth * 24px`
- Add toolbar buttons: "Expand All" / "Collapse All"

#### Modify: `index.ts`

- Read `outlineLevelColumn`, `parentIdColumn`, `sortOrderColumn` from `context.parameters`
- If all three are blank → normal flat table mode (backward compatible)

### 5.4 Row Selection

- Add `enableSelection` prop → render checkbox as first column
- Header checkbox: select all visible / deselect all
- On change → serialize selected IDs → `selectedItems` output

### 5.5 Inline Task Create

- Ghost row at table bottom: light blue dotted border, "＋ Add task" text
- Enter → fire `onTaskCreate` output with `{ parentId: null, title: "...", outlineLevel: 1 }`
- Inside expanded parent: "Add sub-task" → sets parentId + outlineLevel

---

## 6. PCF Control: GanttChart v1.0

### 6.1 Scaffold

```bash
cd pcf-controls/GanttChart
pac pcf init --namespace MSDE --name GanttChart --template dataset --framework react --run-npm-install
npm install frappe-gantt@0.6.1
```

### 6.2 Manifest Properties

**Column mappings (input):** taskTitleColumn, startDateColumn, endDateColumn, percentCompleteColumn, predecessorColumn, outlineLevelColumn, statusColumn

**Config:** viewMode (Day/Week/Month/Quarter enum), enableDragResize, chartHeight, showBaseline, baselineStartColumn, baselineEndColumn

**Outputs:** onDateChange, onProgressChange, onTaskClick (all JSON strings)

### 6.3 Implementation

**`components/GanttView.tsx`** — `useRef` container, `useEffect` to init `new Gantt(...)`, event handlers for date/progress/click changes.

**`utils/taskMapper.ts`** — Maps PCF dataset → frappe-gantt task objects with dependencies + color classes by status.

**Summary Task Rollup:** Parent tasks → aggregated bar from min(children.Start) to max(children.End), weighted progress average.

**CSS:** `.gantt-bar-completed` green, `.gantt-bar-inprogress` blue, `.gantt-bar-blocked` red, `.gantt-bar-notstarted` gray.

---

## 7. Power App Screens

### 7.1 Navigation Architecture

```
App.OnStart:
  Set(varCurrentProject, Blank())
  Set(varProjectListName, "")
  ClearCollect(colBuckets, [])

Navigation: Left sidebar icon rail (always visible)
  🏠 Home        → scrHome
  📋 Tasks       → scrTaskList     (needs project)
  📊 Gantt       → scrGantt        (needs project)
  📌 Board       → scrBoard        (needs project)
  👥 Resources   → scrResources    (needs project)
  📈 Dashboard   → scrDashboard    (needs project)

When project selected on Home:
  Set(varCurrentProject, selectedProject)
  Set(varProjectListName, selectedProject.ProjectListName)
  ClearCollect(colBuckets, ParseJSON(selectedProject.BucketDefinitions))
  Navigate(scrTaskList)
```

### 7.2 Home / Project Selector (`scrHome`)

- ProjectRegistry gallery with cards: Name, Owner, Status badge, date range, task count
- Search bar + Status dropdown filter
- "＋ New Project" button → form → calls PM-CreateProjectList flow
- "Sync ADO" → calls PM-BulkSyncFromADO flow

### 7.3 Task List — Tree View (`scrTaskList`)

**IMPORTANT LIMITATION:** Power Apps Canvas cannot dynamically bind to a SP list by name. **Recommended:** Collection approach — Flow fetches items → returns JSON → `ClearCollect(colTasks, ParseJSON(result))` → PCF bound to collection.

**PCF Properties:**
```
Items                = colTasks
outlineLevelColumn   = "OutlineLevel"
parentIdColumn       = "ParentTaskId"
sortOrderColumn      = "SortOrder"
editableColumns      = "Title,Status,PercentComplete,Priority,Bucket,Start,EndDate"
enableSelection      = true
enableInlineCreate   = true
percentColumnName    = "PercentComplete"
resourceColumnName   = "AssignedTo"
```

**Toolbar:** Indent/Outdent, Delete selected, Save Baseline, Sync to ADO, Refresh

### 7.4 Gantt (`scrGantt`)

GanttChart PCF bound to `colTasks`. View mode toggle. `onDateChange` → `Patch()` SP list. Task click → side panel.

### 7.5 Board / Kanban (`scrBoard`)

Native Power Apps — no PCF. Horizontal containers grouped by Bucket. Task cards with Title, Priority badge, AssignedTo, % mini-bar. "Move to" dropdown (no native drag-drop).

### 7.6 Resource Assignment (`scrResources`)

Left: team member gallery. Right: ModernGrid filtered by person. Bulk reassign. Capacity sub-view from ResourceCapacity list.

### 7.7 Dashboard (`scrDashboard`)

KPI cards (Total/Completed/In Progress/Blocked/Overdue), donut chart by Status, bar chart by Priority, upcoming milestones gallery.

---

## 8. Power Automate Flows

### 8.1 PM-CreateProjectList (Provisioning)

**Trigger:** Power Apps (V2) — inputs: ProjectName, ADO_Project, ADO_AreaPath, Owner, etc.

1. Compose `ProjectListName` = `Tasks_{sanitized_name}`
2. SP HTTP: `POST /_api/web/lists` — create list
3. SP HTTP (x7): Create indexed columns
4. SP HTTP: Create remaining columns
5. Create item in ProjectRegistry
6. Respond with ProjectListName

### 8.2 PM-ADOWorkItemCreated (replaces 2PLANNER-*)

**Trigger:** ADO work item created (1-min polling) | **Concurrency:** runs: 1

1. Get work item details
2. Filter ProjectRegistry by ADO_AreaPath → get ProjectListName
3. Check duplicate (filter by ADO_ID)
4. Create item in project's SP list — **no OperationSet, no child flow, no Schedule API**
5. Set LastSyncTimestamp = utcNow()

### 8.3 PM-ADOWorkItemUpdated (replaces 3PLANNER-*)

**Trigger:** ADO work item updated (1-min polling) | **Concurrency:** runs: 1

1. Get work item details
2. Find SP item by ADO_ID
3. Echo check: if Modified - LastSyncTimestamp < 5s → skip
4. Update SP item fields + map ADO State → SP Status:
   - "New" → "Not Started"
   - "Active" → "In Progress"
   - "Resolved"/"Closed" → "Completed"

### 8.4 PM-BulkSyncFromADO (replaces PlannerDevOpsIntegration-Sync)

**Trigger:** Power App button | **Loop:** concurrency = 1

1. Run ADO saved query
2. For each work item: create or update SP list item
3. Update ProjectRegistry.TaskCount

### 8.5 PM-SyncTaskToADO (NEW — reverse sync)

**Trigger:** SP item modified or Power App button | **Concurrency:** runs: 1

1. Check ADO_ID not blank
2. Echo check (5-second window)
3. Update ADO work item via connector
4. Set LastSyncTimestamp
5. Error → set SyncError column

### 8.6 PM-AggregateResourceData (Scheduled daily)

1. Clear ResourceCapacity list
2. Loop active projects from ProjectRegistry
3. For each: aggregate tasks by AssignedTo → write to ResourceCapacity

### 8.7 PM-MigrateExistingData (One-time)

1. Read master SP list
2. Group by ADO_AreaPath
3. For each group: provision new list, copy items, remap ParentTaskId

---

## 9. Implementation Phases

```
WEEK 1-2: Phase 0 (Foundation) + Phase 1 (ModernGrid) ← PARALLEL
  ├── Phase 0: SP schema + provisioning flow
  └── Phase 1: ModernGrid tree + percent + selection enhancements

WEEK 3-4: Phase 2 (Gantt) + Phase 4 (ADO Sync) ← PARALLEL
  ├── Phase 2: Gantt PCF scaffold + implementation
  └── Phase 4: Rewrite ADO sync flows (no more Schedule APIs)

WEEK 5-6: Phase 3 (Power App Screens)
  ├── 3.1 Home (project selector)
  ├── 3.2 Task List (tree + ModernGrid)
  ├── 3.3 Gantt (GanttChart PCF)
  ├── 3.4 Board (Kanban — native)
  ├── 3.5 Resources (assignment)
  └── 3.6 Dashboard (charts + KPIs)

WEEK 7: Phase 5 (Resource Capacity) + Integration Testing
WEEK 8: Phase 6 (Migration & Deployment)
```

### Dependency Graph

```
Phase 0 ───────────────► Phase 3.1 (Home), Phase 4 (ADO Sync), Phase 3.4 (Board), Phase 3.6 (Dashboard)
Phase 1 ───────────────► Phase 3.2 (Task List), Phase 3.5 (Resources)
Phase 2 ───────────────► Phase 3.3 (Gantt)
Phase 3 + 4 ───────────► Phase 5 (Resource Capacity), Phase 6 (Migration)
```

---

## 10. Verification Plan

### Phase 0 — SP Foundation
- [ ] Create ProjectRegistry manually → verify all 13 columns appear in Power Apps
- [ ] Create TaskTemplate manually → add 20 tasks with 4-level WBS
- [ ] Run PM-CreateProjectList flow → verify list created with all 26 columns + 7 indexes
- [ ] Verify delegation: `Filter(Tasks_Test, Status = "In Progress")` returns correct results

### Phase 1 — ModernGrid PCF
- [ ] `npm start` → load mock data with 4-level hierarchy → verify tree indent
- [ ] Click chevron → verify children collapse/expand
- [ ] PercentComplete → verify progress bar renders (0%, 33%, 67%, 100%)
- [ ] Row checkboxes → select 3 rows → verify `selectedItems` JSON
- [ ] Inline "Add task" → verify `onTaskCreate` output fires
- [ ] Import solution → bind to TaskTemplate list → verify columns auto-detected

### Phase 2 — Gantt PCF
- [ ] `npm start` → verify bars render at correct positions
- [ ] Drag bar end date → verify `onDateChange` output
- [ ] Set Predecessor = "5FS" → verify dependency arrow
- [ ] Toggle view mode → verify timeline scale changes
- [ ] Summary tasks → verify aggregated bar spans min-max of children

### Phase 3 — Power App Screens
- [ ] Home: new project → verify SP list provisioned
- [ ] Task List: expand/collapse tree, inline edit Status → verify SP list updated
- [ ] Gantt: drag bar → verify date change persisted
- [ ] Board: "Move to" → verify Bucket change
- [ ] Resources: bulk reassign → verify AssignedTo updated
- [ ] Dashboard: verify KPI numbers match data

### Phase 4 — ADO Sync
- [ ] Create ADO work item → SP item appears within 2 minutes
- [ ] Edit in Power App → ADO work item updates (no infinite loop)
- [ ] Bulk sync: creates new + updates existing

### Phase 5 — Resource Capacity
- [ ] Run aggregation → ResourceCapacity list populated
- [ ] Capacity screen: utilization bars render per project

---

## 11. Decisions & Constraints

| Decision | Rationale |
|----------|-----------|
| One SP list per project | Avoids 5,000-item view threshold; each project under limit |
| Collection-based data binding | Canvas Apps can't dynamically bind SP lists by name |
| frappe-gantt (MIT) | Lightweight, proven, zero license cost |
| No drag-drop on Kanban | Canvas App limitation; "Move to" dropdown workaround |
| Echo prevention via LastSyncTimestamp | 5-second window prevents bidirectional sync loops |
| Daily scheduled aggregation | Cross-project queries expensive; cache in ResourceCapacity |
| Monorepo | Single repo; PCF controls have independent builds |
| Legacy flows in `legacy/` | Reference only; not deployed |

## 12. Critical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| SP list provisioning HTTP complexity | 26 columns × REST calls | PnP PowerShell for initial; flow for ongoing |
| Dynamic data binding limitation | Can't bind SP list by name at runtime | Collection approach + cache aggressively |
| frappe-gantt in PCF virtual control | Library expects full DOM control | Test early; fall back to `control-type="standard"` |
| 1,000 project lists on one SP site | SP limit ~2,000 lists per site | Monitor; split across subsites if needed |
| ADO sync echo loop | Missed timestamp check → infinite updates | Robust 5-second window + monitoring |

## 13. Scope

**Included:** 6 screens, 2 PCF controls, 7 flows, 3 SP list types, data migration, bidirectional ADO sync, resource capacity

**Excluded:** Timesheet/time tracking, budget/cost management, Teams integration, email notifications, mobile-optimized layout, cross-project critical path, Project Online task migration (SP→SP only)
