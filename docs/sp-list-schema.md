# SharePoint List Schema

> Companion to [architecture.md](architecture.md) — Section 4

---

## 1. ProjectRegistry (Master List)

**Site:** `basf.sharepoint.com/sites/ngba-gb-planner-projects`
**Purpose:** Single registry of all projects. Power App home screen data source.
**Estimated rows:** ~1,000

| # | Column | Internal Name | Type | Required | Indexed | Default | Notes |
|---|--------|---------------|------|----------|---------|---------|-------|
| 1 | Title | Title | Text (255) | Yes | Yes | — | Project display name |
| 2 | ProjectListName | ProjectListName | Text (255) | Yes | Yes | — | SP list name: `Tasks_{sanitized_name}` |
| 3 | ADO_Project | ADO_Project | Text (255) | No | Yes | — | ADO team project name (for sync filter) |
| 4 | ADO_AreaPath | ADO_AreaPath | Text (255) | No | Yes | — | ADO area path (for sync filter) |
| 5 | ADO_Iteration | ADO_Iteration | Text (255) | No | No | — | ADO iteration path (for sync filter) |
| 6 | ADO_QueryId | ADO_QueryId | Text (255) | No | No | — | Saved ADO WIQL query ID for bulk sync |
| 7 | Owner | Owner | Person | No | No | — | Project owner |
| 8 | ProjectStatus | ProjectStatus | Choice | Yes | Yes | Active | Not Started / Active / On Hold / Completed / Archived |
| 9 | StartDate | StartDate | Date Only | No | No | — | Project start |
| 10 | EndDate | EndDate | Date Only | No | No | — | Project end |
| 11 | BucketDefinitions | BucketDefinitions | Multi-line (plain) | No | No | `["Backlog","To Do","In Progress","Review","Done"]` | JSON array of Kanban column names |
| 12 | Description | Description | Multi-line (rich) | No | No | — | Project description |
| 13 | TaskCount | TaskCount | Number (0 dec) | No | No | 0 | Cached count (updated by aggregation flow) |

**Indexes:** Title, ProjectListName, ADO_Project, ADO_AreaPath, ProjectStatus — **5 indexes**

### Views

| View Name | Filter | Sort | Default |
|-----------|--------|------|---------|
| Active Projects | ProjectStatus = Active | Title asc | Yes |
| All Projects | (none) | Modified desc | No |
| My Projects | Owner = [Me] | Title asc | No |

---

## 2. Task List Template (Per-Project)

**Pattern:** One list per project, named `Tasks_{ProjectName}` (e.g., `Tasks_WaveOne_FA`)
**Purpose:** All task data for a single project. Replaces both the SP tracking list AND Project Online `msdyn_projecttask`.
**Target:** < 5,000 items per list (avoids view threshold)

| # | Column | Internal Name | Type | Required | Indexed | Default | Notes |
|---|--------|---------------|------|----------|---------|---------|-------|
| 1 | Title | Title | Text (255) | Yes | Yes | — | Task name |
| 2 | OutlineLevel | OutlineLevel | Number (0 dec) | Yes | Yes | 1 | WBS depth: 1=root, 2=child, 3=grandchild, etc. |
| 3 | ParentTaskId | ParentTaskId | Number (0 dec) | No | Yes | — | SP item ID of parent task (blank = root) |
| 4 | SortOrder | SortOrder | Number (0 dec) | Yes | No | 0 | Display order within siblings |
| 5 | PSP | PSP | Text (50) | No | No | — | WBS path code: "1.2.3" |
| 6 | PercentComplete | PercentComplete | Number (0 dec) | No | No | 0 | 0–100 |
| 7 | Priority | Priority | Choice | No | No | Medium | Critical / High / Medium / Low |
| 8 | Status | Status | Choice | Yes | Yes | Not Started | Not Started / In Progress / Completed / Blocked / Cancelled |
| 9 | Bucket | Bucket | Text (100) | No | Yes | Backlog | Kanban column grouping |
| 10 | Start | Start | Date Only | No | No | — | Planned start date |
| 11 | EndDate | EndDate | Date Only | No | No | — | Planned end date |
| 12 | Duration | Duration | Number (0 dec) | No | No | — | Working days |
| 13 | Start_Baseline | Start_Baseline | Date Only | No | No | — | Frozen baseline start |
| 14 | End_Baseline | End_Baseline | Date Only | No | No | — | Frozen baseline end |
| 15 | Predecessor | Predecessor | Text (255) | No | No | — | Dependencies: `"5FS,12SS+2d"` |
| 16 | AssignedTo | AssignedTo | Person (multi) | No | No | — | Resource assignment |
| 17 | ADO_ID | ADO_ID | Number (0 dec) | No | Yes | — | Azure DevOps work item ID |
| 18 | ADO_State | ADO_State | Text (100) | No | No | — | Synced from ADO System.State |
| 19 | ADO_WorkItemType | ADO_WorkItemType | Text (100) | No | No | — | Bug, User Story, Task, etc. |
| 20 | ADO_AreaPath | ADO_AreaPath | Text (255) | No | Yes | — | Synced area path |
| 21 | ADO_IterationPath | ADO_IterationPath | Text (255) | No | No | — | Synced iteration path |
| 22 | ADO_Responsible | ADO_Responsible | Text (255) | No | No | — | ADO responsible person |
| 23 | ADO_BO_ID | ADO_BO_ID | Text (100) | No | No | — | Business object ID |
| 24 | LastSyncTimestamp | LastSyncTimestamp | DateTime | No | No | — | Echo-loop prevention for bidirectional sync |
| 25 | SyncError | SyncError | Text (255) | No | No | — | Last sync error message (if any) |
| 26 | Notes | Notes | Multi-line (rich) | No | No | — | Task notes |

**Indexes:** Title, OutlineLevel, ParentTaskId, Status, Bucket, ADO_ID, ADO_AreaPath — **7 indexes** (well within 20/list limit)

### Predecessor Format

Dependencies use the format `{ItemId}{Type}{Lag}` where:
- **ItemId** = SP list item ID of the predecessor task
- **Type** = `FS` (Finish-to-Start), `SS` (Start-to-Start), `FF` (Finish-to-Finish), `SF` (Start-to-Finish)
- **Lag** = optional lag duration: `+2d` (add 2 days), `-1d` (subtract 1 day)
- Multiple predecessors separated by commas: `"5FS,12SS+2d,18FF"`

### Choice Values

**Priority:**
| Value | Display |
|-------|---------|
| Critical | Critical |
| High | High |
| Medium | Medium |
| Low | Low |

**Status:**
| Value | Display | Maps to ADO State |
|-------|---------|-------------------|
| Not Started | Not Started | New |
| In Progress | In Progress | Active |
| Completed | Completed | Resolved, Closed |
| Blocked | Blocked | — |
| Cancelled | Cancelled | Removed |

---

## 3. ResourceCapacity (Cross-Project Aggregation)

**Purpose:** Aggregated resource data populated by daily scheduled flow. One row per person-project combination.
**Updated by:** PM-AggregateResourceData flow (runs daily at 02:00 UTC)

| # | Column | Internal Name | Type | Required | Indexed | Default | Notes |
|---|--------|---------------|------|----------|---------|---------|-------|
| 1 | PersonName | PersonName | Text (255) | Yes | Yes | — | Full name |
| 2 | PersonEmail | PersonEmail | Text (255) | Yes | Yes | — | Email (unique key per project) |
| 3 | ProjectName | ProjectName | Text (255) | Yes | No | — | From ProjectRegistry.Title |
| 4 | ProjectListName | ProjectListName | Text (255) | No | No | — | SP list name reference |
| 5 | TaskCount | TaskCount | Number (0 dec) | No | No | 0 | Tasks assigned to this person in this project |
| 6 | TotalDuration | TotalDuration | Number (0 dec) | No | No | 0 | Sum of Duration for assigned tasks |
| 7 | CompletedTasks | CompletedTasks | Number (0 dec) | No | No | 0 | Tasks with Status = Completed |
| 8 | EarliestStart | EarliestStart | Date Only | No | No | — | Min(Start) of assigned tasks |
| 9 | LatestEnd | LatestEnd | Date Only | No | No | — | Max(EndDate) of assigned tasks |
| 10 | AvgPercentComplete | AvgPercentComplete | Number (0 dec) | No | No | 0 | Average PercentComplete |
| 11 | LastUpdated | LastUpdated | DateTime | No | No | — | When this row was last refreshed |

**Indexes:** PersonName, PersonEmail — **2 indexes**
