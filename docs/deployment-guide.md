# Deployment Guide

> Step-by-step instructions for deploying the Project Management solution.

---

## Prerequisites

1. **SharePoint Online** site: `basf.sharepoint.com/sites/ngba-gb-planner-projects` (or your target site)
2. **Power Platform** environment with Canvas App and Flow creation permissions
3. **Azure DevOps** project access (for ADO sync flows)
4. **Node.js 18+** — for building PCF controls
5. **Power Platform CLI** (`pac`) — `npm install -g pac`
6. **.NET SDK 6.0+** — for `dotnet build` (PCF solution packaging)
7. **PnP PowerShell** — `Install-Module -Name PnP.PowerShell` (for SP list provisioning)

---

## Phase 0: SharePoint Foundation

### Step 1: Provision Lists via PnP PowerShell

```powershell
cd sp-templates
.\create-lists.ps1 -SiteUrl "https://basf.sharepoint.com/sites/ngba-gb-planner-projects"
```

This creates:
- **ProjectRegistry** list with 13 columns + 5 indexes + 3 views
- **TaskTemplate** list with 26 columns + 7 indexes (template for provisioning flow)
- **ResourceCapacity** list with 11 columns + 2 indexes

### Step 2: Verify Lists

1. Navigate to the SP site → Site Contents
2. Confirm all three lists exist with correct columns
3. Add a test item to ProjectRegistry → verify in Power Apps data source

### Step 3: Add Sample Data

Create 1 test project in ProjectRegistry:
- Title: "Test Project"
- ProjectListName: "Tasks_Test_Project"
- ProjectStatus: "Active"

Manually create the `Tasks_Test_Project` list (copy from TaskTemplate) and add 10-20 sample tasks with varying OutlineLevel (1-4), ParentTaskId references, and Predecessor values.

---

## Phase 1: Build & Deploy PCF Controls

### Step 1: Build ModernGrid

```powershell
cd pcf-controls/ModernGrid
npm install
npm run build
```

### Step 2: Build GanttChart

```powershell
cd pcf-controls/GanttChart
npm install
npm run build
```

### Step 3: Package PCF Solution

```powershell
cd pcf-controls/Solution
dotnet build
```

Output: `bin/Debug/Solution.zip`

### Step 4: Import to Power Platform

```powershell
pac auth create --environment https://yourorg.crm.dynamics.com
pac solution import --path pcf-controls/Solution/bin/Debug/Solution.zip
```

Or via portal:
1. Go to `make.powerapps.com` → Solutions → Import
2. Upload `Solution.zip`
3. Publish all customizations

---

## Phase 2: Create Power Automate Flows

Create each flow manually in `make.powerautomate.com` following the specifications in [architecture.md](architecture.md) sections 8.1–8.7.

### Flow Creation Order (dependencies matter)

1. **PM-CreateProjectList** — no dependencies
2. **PM-ADOWorkItemCreated** — depends on ProjectRegistry existing
3. **PM-ADOWorkItemUpdated** — depends on ProjectRegistry existing
4. **PM-BulkSyncFromADO** — depends on ProjectRegistry existing
5. **PM-SyncTaskToADO** — depends on ADO connector
6. **PM-AggregateResourceData** — depends on ProjectRegistry + ResourceCapacity
7. **PM-MigrateExistingData** — depends on PM-CreateProjectList

### After Creating Each Flow

Export the flow definition as JSON and save to `flows/` folder:
1. Open flow in portal → Export → Package (.zip)
2. Extract JSON definition
3. Save as `flows/PM-{FlowName}.json`
4. Commit to git

---

## Phase 3: Create Canvas App

1. Go to `make.powerapps.com` → Canvas app from blank
2. Name: "Project Management"
3. Create 6 screens following [architecture.md](architecture.md) section 7
4. Import PCF controls (ModernGrid, GanttChart) via Insert → Get more components → Code
5. Add data sources: ProjectRegistry, ResourceCapacity
6. Connect flows: PM-CreateProjectList, PM-BulkSyncFromADO, PM-SyncTaskToADO
7. Save and publish

---

## Phase 4: Data Migration

1. Ensure all current SP list data is backed up
2. Run **PM-MigrateExistingData** flow
3. Verify each project got its own list with correct data
4. Verify ParentTaskId remapping for hierarchical tasks
5. Turn off legacy flows (2PLANNER-*, 3PLANNER-*, PlannerDevOpsIntegration-Sync)

---

## Phase 5: Go Live

1. Share Canvas App with project managers
2. Verify ADO sync flows are running (check flow run history)
3. Verify PM-AggregateResourceData scheduled trigger is active
4. Monitor for 1 week — check SyncError columns for any issues
5. Decommission legacy PlannerFlows solution after validation period

---

## Rollback Plan

If issues arise:
1. Turn off new flows (PM-*)
2. Re-enable legacy flows (2PLANNER-*, 3PLANNER-*)
3. Legacy Power App (paloma_plannermasterapp) remains available in `legacy/` solution
4. SP list data is preserved (no destructive changes to existing data)
