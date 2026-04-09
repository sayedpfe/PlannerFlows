# ADO ↔ SharePoint Bidirectional Field Mapping

> Companion to [architecture.md](architecture.md) — Sections 8.2–8.5

---

## 1. ADO → SP List (Forward Sync)

Used by flows: **PM-ADOWorkItemCreated**, **PM-ADOWorkItemUpdated**, **PM-BulkSyncFromADO**

| ADO Field | ADO Internal Name | SP Column | SP Internal Name | Type | Notes |
|-----------|-------------------|-----------|-----------------|------|-------|
| Title | System.Title | Title | Title | Text | Direct copy |
| Work Item ID | System.Id | ADO_ID | ADO_ID | Number | Unique key for sync matching |
| State | System.State | ADO_State | ADO_State | Text | Raw ADO state value |
| State (mapped) | System.State | Status | Status | Choice | Mapped (see table below) |
| Work Item Type | System.WorkItemType | ADO_WorkItemType | ADO_WorkItemType | Text | Bug, User Story, Task, etc. |
| Area Path | System.AreaPath | ADO_AreaPath | ADO_AreaPath | Text | Used to match ProjectRegistry |
| Iteration Path | System.IterationPath | ADO_IterationPath | ADO_IterationPath | Text | |
| Start Date (Actual) | Custom.StartDate_Actual | Start | Start | Date | Format: `yyyy-MM-dd` |
| End Date (Actual) | Custom.EndDate_Actual | EndDate | EndDate | Date | Format: `yyyy-MM-dd` |
| Start Date (Plan) | Custom.StartDate_Plan | Start_Baseline | Start_Baseline | Date | Only on initial create |
| End Date (Plan) | Custom.EndDate_Plan | End_Baseline | End_Baseline | Date | Only on initial create |
| Responsible | Custom.Responsible | ADO_Responsible | ADO_Responsible | Text | |
| Business Object ID | Custom.BO_ID | ADO_BO_ID | ADO_BO_ID | Text | |

### State Mapping (ADO → SP)

| ADO System.State | SP Status (Choice) |
|------------------|---------------------|
| New | Not Started |
| Active | In Progress |
| Resolved | Completed |
| Closed | Completed |
| Removed | Cancelled |

### Default Values on Create

When a new ADO work item creates a SP list item, these defaults are applied:

| SP Column | Default Value |
|-----------|---------------|
| OutlineLevel | 1 |
| SortOrder | 0 |
| Bucket | "Backlog" |
| PercentComplete | 0 |
| Priority | "Medium" |
| LastSyncTimestamp | `utcNow()` |

---

## 2. SP List → ADO (Reverse Sync)

Used by flow: **PM-SyncTaskToADO**

> **Note:** Exact reverse field mapping is configurable. The fields below are the initial set. Additional mappings can be added later.

| SP Column | SP Internal Name | ADO Field | ADO Internal Name | Notes |
|-----------|-----------------|-----------|-------------------|-------|
| Status | Status | State | System.State | Mapped (see table below) |
| Start | Start | Start Date (Actual) | Custom.StartDate_Actual | Format: `yyyy-MM-ddT07:00:00Z` |
| EndDate | EndDate | End Date (Actual) | Custom.EndDate_Actual | Format: `yyyy-MM-ddT15:00:00Z` |
| *(additional fields TBD)* | | | | User will specify more mappings |

### State Mapping (SP → ADO)

| SP Status | ADO System.State |
|-----------|------------------|
| Not Started | New |
| In Progress | Active |
| Completed | Resolved |
| Blocked | Active |
| Cancelled | Removed |

---

## 3. Echo Prevention

Bidirectional sync can cause infinite loops if not guarded. The `LastSyncTimestamp` column prevents this.

### How It Works

```
ADO TRIGGER FIRES
  ↓
Flow gets work item details
  ↓
Flow reads SP item by ADO_ID
  ↓
CHECK: (SP item Modified) - (SP item LastSyncTimestamp) < 5 seconds?
  YES → SKIP (this was our own update echoing back)
  NO  → UPDATE SP item + set LastSyncTimestamp = utcNow()
```

```
SP TRIGGER FIRES
  ↓
Flow gets SP item
  ↓
CHECK: ADO_ID is blank?
  YES → SKIP (not an ADO-linked task)
  ↓
CHECK: (SP item Modified) - (SP item LastSyncTimestamp) < 5 seconds?
  YES → SKIP (this was our own update echoing back)
  NO  → UPDATE ADO work item + set LastSyncTimestamp = utcNow()
```

### Key Rules

1. **Every flow that writes** to either SP or ADO **must set `LastSyncTimestamp = utcNow()`** after the write
2. **Every flow that reads** before writing **must check** the 5-second window
3. ADO flows use `runs: 1` concurrency to serialize and prevent race conditions
4. SP → ADO flow also uses `runs: 1` concurrency

---

## 4. ADO Connection Details

| Property | Value |
|----------|-------|
| Connection Reference | `paloma_sharedvisualstudioteamservices_df734` |
| Connector | `shared_visualstudioteamservices` |
| Trigger Type | Polling (1-minute interval) |
| Trigger Filter | Work item type + Area Path (configured per project in ProjectRegistry) |

### ADO Custom Fields Reference

| Custom Field | ADO Internal Name | Type |
|---|---|---|
| Start Date (Actual) | Custom.StartDate_Actual | DateTime |
| End Date (Actual) | Custom.EndDate_Actual | DateTime |
| Start Date (Plan) | Custom.StartDate_Plan | DateTime |
| End Date (Plan) | Custom.EndDate_Plan | DateTime |
| Business Object ID | Custom.BO_ID | String |
| Primary Owner | Custom.PrimaryOwner_DMP | String |
| Task Type | Custom.TaskType_DMP | String |
| Responsible | Custom.Responsible | String |
