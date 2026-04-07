# OperationSet Limit Fix Guide
## Error: ScheduleAPI-OV-0004 — Maximum 10 operation sets per user

This guide walks through every portal change needed to fix the error.
**Do not edit any flow JSON files directly — apply all changes through the Power Automate portal.**

---

## Progress tracker

| # | Flow | Status |
|---|---|---|
| 1 | `ChildFlow-PlannerTask-CreateUpdate` (FFC9CF08) | 🔄 In progress — stopped at Step J (test) |
| 2 | `ChildFlow-ScheduleAPIs-PlannerTask` (FCD62B40) | ⏳ Pending |
| 3 | `PlannerDevOpsIntegration-Sync` (33C494CA) | ⏳ Pending |
| 4 | `2PLANNER-NewWorkItemIsCreated-withoutfilters` (AC7D2707) | ⏳ Pending |
| 5 | `AssignResourceFromSPList` (A2979AF6) | ⏳ Pending |

---

## Safe deployment strategy (copy-then-switch)

To avoid breaking live flows while applying changes:

1. **Copy** the child flow and rename the copy
2. **Apply all changes** on the copy only
3. **Test the copy** in isolation (manual trigger with test IDs)
4. **Switch the parent** to point to the fixed copy
5. **End-to-end test** via the parent flow
6. **Turn off the original** (do NOT delete — keep as rollback)
7. **Export solution + commit** to GitHub

### Current environment context
- `SyncExceltoPlanner` is ON but non-functional (its child flow `ChildFlow-PlannerTask-CreateUpdate` is OFF)
- Safe to work — no live traffic on the child flow path
- Test resources confirmed: ProjectID and BucketID available

---

## Background: Why the error happens

Every call to `CreateOperationSetV1` opens a slot against the 10-OperationSet limit for the
service account. That slot is only released when the OperationSet reaches a terminal state
(Completed = 192350003 or Failed = 192350002). The current flows:

1. Use a **fixed 40-second delay** then check status **once** — if the system is under load
   and 40 s is not enough, the slot stays open and the parent loop starts the next task,
   stacking open slots until the limit is hit.
2. Call the child flow from loops **without concurrency = 1**, so multiple slots open in
   parallel within a single flow run.
3. Are triggered by multiple parent flows that share the same service account pool.

---

## Flows and fixes summary

| # | Flow | Fix type | Priority |
|---|---|---|---|
| 1 | `ChildFlow-PlannerTask-CreateUpdate` (FFC9CF08) | Replace fixed delay with polling loop | 🔴 Critical |
| 2 | `ChildFlow-ScheduleAPIs-PlannerTask` (FCD62B40) | Replace fixed delay with polling loop | 🔴 Critical |
| 3 | `PlannerDevOpsIntegration-Sync` (33C494CA) | Serialize Apply_to_each loop | 🔴 Critical |
| 4 | `2PLANNER-NewWorkItemIsCreated-withoutfilters` (AC7D2707) | Serialize trigger + loop | 🟡 High |
| 5 | `AssignResourceFromSPList` (A2979AF6) | Serialize trigger + loop | 🟡 High |

---

---

# FIX 1 — `ChildFlow-PlannerTask-CreateUpdate`

**Original Flow ID:** FFC9CF08-57FB-F011-8406-000D3AB2C546
**Copy name:** `ChildFlow-PlannerTask-CreateUpdate-FIXED`
**Copy Flow ID:** F1C76009-9732-F111-88B5-000D3AB2C546
**Used by:** SyncExceltoPlanner
**Status:** 🔄 In progress — Steps A–I complete, stopped at Step J (isolated test)

**What to change:** Replace the single `Delay_-_Persist_to_Dataverse` (40 s) + single
`Get_OperationSet` check with a polling loop that waits until the OperationSet is truly closed.

### Step A — Create the copy
- [x] **A1.** Go to **make.powerautomate.com**
- [x] **A2.** Navigate to **My flows** — find **ChildFlow-PlannerTask-CreateUpdate**
- [x] **A3.** Click the **...** (three dots) next to the flow → click **Save as**
- [x] **A4.** Name the copy: `ChildFlow-PlannerTask-CreateUpdate-FIXED`
- [x] **A5.** Click **Save**
- [x] **A6.** Open the copy and click **Edit** — confirm it has all the same actions as the original
- [x] **A7.** Note the new GUID from the URL bar — **F1C76009-9732-F111-88B5-000D3AB2C546**

> All remaining steps below are performed on the **COPY only**.
> The original flow (FFC9CF08) must remain untouched.

> **Session note (2026-04-07):** Steps B–I completed. Flow saved with no red errors.
> Stopped at Step J — test pending next session.

### Current structure (actions at the bottom of the flow, in order):
```
Condition_1  (Create vs Update — both branches contain their own Execute call)
  ↓
Delay_-_Persist_to_Dataverse      ← DELETE THIS
  ↓
Get_OperationSet                  ← DELETE THIS
  ↓
Did_OperationSet_succeed          ← KEEP, but update its condition expression
  ↓
Respond_to_a_Power_App_or_flow    ← KEEP, no changes
```

### Target structure after fix:
```
Condition_1
  ↓
Initialize_varOpSetStatus  (new)
  ↓
Poll_Until_Done  Do Until loop  (new)
  │  ├── Delay 15 s
  │  ├── Get_OperationSet_Poll  (Dataverse Get a row)
  │  └── Set_varOpSetStatus
  ↓
Did_OperationSet_succeed   (update condition — reads variable instead of Get_OperationSet output)
  ↓
Respond_to_a_Power_App_or_flow
```

---

### ✅ Step B — Delete `Delay_-_Persist_to_Dataverse` on the COPY

> You should already be in **Edit** mode on `ChildFlow-PlannerTask-CreateUpdate-FIXED`

- [x] **B1.** Scroll to the bottom of the flow. Locate the action **Delay - Persist to Dataverse**
      (clock icon, note says "40 Seconds", sits below `Condition_1`)
- [x] **B2.** Click the **...** (three dots) on that action card
- [x] **B3.** Click **Delete** → confirm

### ✅ Step C — Delete the standalone `Get_OperationSet`

> This is the `Get_OperationSet` outside any loop — it sits directly below where the Delay was.
> Do NOT delete any `Get_OperationSet` inside a scope or loop if one exists.

- [x] **C1.** Find the **Get_OperationSet** action now at the top of the gap
      (Dataverse connector, entity = Operation Sets)
- [x] **C2.** Click **...** → **Delete** → confirm

> ⚠️ After deleting both, the `Did_OperationSet_succeed` condition card will show a red
> warning — its expression references the now-deleted `Get_OperationSet` output.
> This is expected. You will fix it in Step G.

### ✅ Step D — Add `Initialize variable` for polling status

- [x] **D1.** Click the **+** button that now appears in the gap between
      `Condition_1` and `Did_OperationSet_succeed`
- [x] **D2.** Search **Initialize variable** → select it
- [x] **D3.** Fill in:
      - **Name:** `varOpSetStatus`
      - **Type:** `Integer`
      - **Value:** `0`
- [x] **D4.** Click the action title at the top and rename it to: `Initialize_varOpSetStatus`

### ✅ Step E — Add the `Do Until` polling loop

- [x] **E1.** Click **+** below `Initialize_varOpSetStatus`
- [x] **E2.** Search **Do Until** → select it (under the **Control** category)
- [x] **E3.** Set the loop exit condition. The Do Until condition panel has Left / Operator / Right:
      - Click the **Left** field → switch to **Expression** tab → type:
        ```
        @or(equals(variables('varOpSetStatus'), 192350003), equals(variables('varOpSetStatus'), 192350002))
        ```
      - Operator: **is equal to**
      - Right: `true`

      > This exits the loop when status is either Completed (192350003) OR Failed (192350002).

- [x] **E4.** Set loop limits — click **Settings** (gear icon on the Do Until card):
      - **Count:** `20`
      - **Timeout:** `PT15M`
      - Click **Done**
- [x] **E5.** Rename the Do Until to: `Poll_Until_OperationSet_Done`

### ✅ Step F — Add 3 actions INSIDE the Do Until loop

Click **Add an action** inside the `Poll_Until_OperationSet_Done` loop body.
Add all three **in order**:

#### F1 — Delay 15 seconds
- [x] Search **Delay** → select it (Control connector)
- [x] Count: `15` / Unit: `Second`
- [x] Rename to: `Delay_Poll_15s`

#### F2 — Get the OperationSet row from Dataverse
- [x] Click **+** below `Delay_Poll_15s` inside the loop
- [x] Search **Get a row by ID** → select **Microsoft Dataverse (legacy)**
      (same connector already used in the rest of this flow)
- [x] Configure:
      - **Table name:** type `Operation Sets` and select `msdyn_operationsets`
      - **Row ID:** click the **Expression** (fx) tab and type:
        ```
        outputs('OperationSetId')
        ```
- [x] Rename to: `Get_OperationSet_Poll`

#### F3 — Set the status variable
- [x] Click **+** below `Get_OperationSet_Poll` inside the loop
- [x] Search **Set variable** → select it
- [x] Configure:
      - **Name:** pick `varOpSetStatus` from the dropdown
      - **Value:** click **Expression** tab and type:
        ```
        outputs('Get_OperationSet_Poll')?['body/msdyn_status']
        ```
- [x] Rename to: `Set_varOpSetStatus`

### ✅ Step G — Fix the `Did_OperationSet_succeed` condition

- [x] **G1.** Click on the **Did_OperationSet_succeed** condition card
- [x] **G2.** The existing left-side expression shows a red error (references deleted action)
      — click the **X** or trash icon on that expression row to remove it
- [x] **G3.** Add a new condition row:
      - Left side → **Expression** tab:
        ```
        variables('varOpSetStatus')
        ```
      - Operator: **is equal to**
      - Right side: `192350003`
- [x] **G4.** Confirm: the **Yes** branch leads to `PSS_has_persisted_changes_to_Dataverse`
      and the **No** branch leads to the Terminate action

### ✅ Step H — Update the Terminate error message

- [x] **H1.** Inside **Did_OperationSet_succeed** → **No** branch
- [x] **H2.** Click on `Terminate_as_Failed_for_failed_PSS_persist`
- [x] **H3.** Replace the Message value with:
      ```
      OperationSet did not complete. Final status: @{variables('varOpSetStatus')}
      ```

### ✅ Step I — Save the COPY

- [x] **I1.** Click **Save** at the top
- [x] **I2.** Confirm no red errors remain on any action card
      (the only acceptable warnings are yellow advisory ones, not red blocking ones)

### ⏸️ Step J — Test the COPY in isolation (manual trigger) — STOPPED HERE

- [ ] **J1.** On the COPY flow page, click **Test** → **Manually** → **Run flow**
- [ ] **J2.** Fill in the test inputs:
      - **ProjectID:** _(your test Project GUID)_
      - **TaskTitle:** `Test-PollingLoop-Fix1`
      - **BucketID:** _(your test Bucket GUID)_
      - **Start:** leave blank (optional)
      - **End:** leave blank (optional)
      - **TaskId:** leave blank (empty = CREATE path)
- [ ] **J3.** Click **Run flow** → **Done**
- [ ] **J4.** Watch the run history. Verify:
      - `Call_CreateOperationSetV1` — ✅ Succeeded
      - `Condition_1` — ✅ Succeeded (took the Create branch because TaskId was empty)
      - `Initialize_varOpSetStatus` — ✅ Succeeded
      - `Poll_Until_OperationSet_Done` — ✅ ran at least 1 iteration and exited
      - `Set_varOpSetStatus` shows value `192350003` in the last iteration
      - `Did_OperationSet_succeed` — ✅ took the **Yes** branch
      - `Respond_to_a_Power_App_or_flow` — ✅ returned a non-empty `taskid`
- [ ] **J5.** Record the returned `taskid` — verify the task appears in Planner Premium

### Step K — Switch `SyncExceltoPlanner` to the COPY

- [ ] **K1.** Note the GUID of the COPY from its URL in the browser address bar
      (format: `https://make.powerautomate.com/environments/.../flows/XXXXXXXX-...`)
- [ ] **K2.** Open **SyncExceltoPlanner** → click **Edit**
- [ ] **K3.** Inside the `For_each` loop, find the **Run a Child Flow** action
- [ ] **K4.** Click on it → the **Flow** dropdown shows the current child flow name
- [ ] **K5.** Change the selection to **ChildFlow-PlannerTask-CreateUpdate-FIXED**
- [ ] **K6.** Click **Save**

### Step L — End-to-end test via SyncExceltoPlanner

- [ ] **L1.** Trigger `SyncExceltoPlanner` (modify the watched SP list item or use Test)
- [ ] **L2.** Check the run — confirm the `For_each` loop completes for all rows
- [ ] **L3.** Confirm no OperationSet limit error in the run history
- [ ] **L4.** Confirm tasks appear / update correctly in Planner Premium

### Step M — Turn off the original flow

- [ ] **M1.** Go to the **original** `ChildFlow-PlannerTask-CreateUpdate` (FFC9CF08)
- [ ] **M2.** Click **...** → **Turn off**
      ⚠️ Do NOT delete — keep as rollback for 2 weeks minimum

### Step N — Export solution and commit to GitHub

- [ ] **N1.** Export the updated solution from the Power Platform admin center or maker portal
- [ ] **N2.** Replace the solution folder in the local workspace
- [ ] **N3.** Run from VS Code terminal:
      ```powershell
      cd "d:\OneDrive\OneDrive - Microsoft\Documents\Learning Projects\PlannerFlows"
      git add .
      git commit -m "Fix 1: Replace fixed delay with polling loop in ChildFlow-PlannerTask-CreateUpdate-FIXED"
      git push
      ```

---

---

# FIX 2 — `ChildFlow-ScheduleAPIs-PlannerTask`

**Flow ID:** FCD62B40-16D5-F011-8544-7C1E5234EF55
**Used by:** 2PLANNER-NewWorkItemIsCreated-withoutfilters, PlannerDevOpsIntegration-Sync

**What to change:** Same as Fix 1 — replace fixed delay + single check with polling loop.

### Current structure (bottom of flow):
```
Project_Task_-_Subtask  (Scope)
  ↓
Call_AbandonOperationSetV1_-_Subtask   (runs on Scope failure)
  ↓
Call_ExecuteOperationSetV1             (runs when Abandon is Skipped)
  ↓
Delay_-_Persist_to_Dataverse          ← DELETE THIS
  ↓
Get_OperationSet                      ← DELETE THIS
  ↓
Did_OperationSet_succeed              ← KEEP, update condition
  ↓
Respond_to_a_Power_App_or_flow        ← KEEP, no changes
```

### Target structure after fix:
```
...
Call_ExecuteOperationSetV1
  ↓
Initialize_varOpSetStatus   (new)
  ↓
Poll_Until_OperationSet_Done  Do Until  (new)
  │  ├── Delay_Poll_15s
  │  ├── Get_OperationSet_Poll
  │  └── Set_varOpSetStatus
  ↓
Did_OperationSet_succeed   (updated condition)
  ↓
Respond_to_a_Power_App_or_flow
```

---

### Step-by-step portal instructions

#### Step 1 — Open the flow
1. Go to **make.powerautomate.com**
2. Navigate to **My flows** → find **ChildFlow-ScheduleAPIs-PlannerTask**
3. Click **Edit**

#### Step 2 — Delete `Delay_-_Persist_to_Dataverse`
1. Find the **Delay** action (40 Seconds) below `Call_ExecuteOperationSetV1`
2. Click **...** → **Delete** → Confirm

#### Step 3 — Delete standalone `Get_OperationSet`
1. Find the **Get_OperationSet** action that was directly below the Delay
2. Click **...** → **Delete** → Confirm

#### Step 4 — Add `Initialize variable` for polling status
1. Click **+** between `Call_ExecuteOperationSetV1` and `Did_OperationSet_succeed`
2. Add **Initialize variable**:
   - **Name:** `varOpSetStatus`
   - **Type:** Integer
   - **Value:** `0`
3. Rename to: `Initialize_varOpSetStatus`

#### Step 5 — Add `Do Until` polling loop
1. Click **+** below `Initialize_varOpSetStatus`
2. Add **Do Until** (Control)
3. Set exit condition (expression mode):
   ```
   @or(equals(variables('varOpSetStatus'), 192350003), equals(variables('varOpSetStatus'), 192350002))
   ```
   — compare to `true`
4. Limits: Count `20`, Timeout `PT15M`
5. Rename to: `Poll_Until_OperationSet_Done`

#### Step 6 — Add actions INSIDE the Do Until loop

**Action 6a — Delay 15 seconds**
- **Delay**: Count `15`, Unit `Second`
- Rename to: `Delay_Poll_15s`

**Action 6b — Get OperationSet row**
- **Get a row** (Microsoft Dataverse legacy connector)
- Entity Name: `Operation Sets` (`msdyn_operationsets`)
- Item ID (expression): `outputs('OperationSetId')`
- Rename to: `Get_OperationSet_Poll`

**Action 6c — Set status variable**
- **Set variable**
- Name: `varOpSetStatus`
- Value (expression): `outputs('Get_OperationSet_Poll')?['body/msdyn_status']`
- Rename to: `Set_varOpSetStatus`

#### Step 7 — Update `Did_OperationSet_succeed` condition
1. Click on the **Did_OperationSet_succeed** condition
2. Replace the broken expression (referencing deleted `Get_OperationSet`) with:
   - Left side expression: `variables('varOpSetStatus')`
   - Operator: **is equal to**
   - Right side: `192350003`

#### Step 8 — Update Terminate error message (False branch)
- Message:
  ```
  OperationSet did not complete successfully. Final status: @{variables('varOpSetStatus')}
  ```

#### Step 9 — Save and test
1. Click **Save**
2. Trigger via the parent flow **2PLANNER-NewWorkItemIsCreated-withoutfilters** with a test
   ADO item and confirm the task is created and the flow completes without error.

---

---

# FIX 3 — `PlannerDevOpsIntegration-Sync`

**Flow ID:** 33C494CA-27F2-F011-8406-000D3AB2C546
**Used by:** Canvas App (PowerApp button trigger — manually invoked)

**What to change:** The `Apply_to_each` loop iterates over ADO query results (potentially
50+ items with pagination) and calls `ChildFlow-ScheduleAPIs-PlannerTask` for each one
with **no concurrency limit**. This is the highest-risk flow for hitting the 10-OperationSet
limit. Serializing the loop so only 1 child flow call runs at a time eliminates the problem.

### Current state:
- Trigger: PowerApp button, `concurrency.runs: 1` ✅ already set
- `Apply_to_each` loop over ADO query results: **no `repetitions` limit** ⚠️

---

### Step-by-step portal instructions

#### Step 1 — Open the flow
1. Go to **make.powerautomate.com**
2. Navigate to **My flows** → find **PlannerDevOpsIntegration-Sync**
3. Click **Edit**

#### Step 2 — Enable Concurrency Control on the `Apply_to_each` loop
1. Find the **Apply_to_each** loop action (it loops over `body('Parse_JSON')` — the ADO
   query results — and calls `Run_a_Child_Flow` inside it)
2. Click the **...** (three dots) on the top-right of the loop card
3. Click **Settings**
4. Under **Concurrency Control** — toggle the switch **ON**
5. The **Degree of Parallelism** slider appears — drag it to **1**
   (or type `1` in the field)
6. Click **Done**

#### Step 3 — Save
1. Click **Save**

> **Effect:** The loop will now process one ADO work item at a time. Each call to the child
> flow must fully complete (including the new polling loop from Fix 2) before the next item
> starts. Maximum 1 open OperationSet from this flow at any moment.

---

---

# FIX 4 — `2PLANNER-NewWorkItemIsCreated-withoutfilters`

**Flow ID:** AC7D2707-12D5-F011-8544-7C1E5234EF55
**Used by:** ADO "work item created" trigger (automated)

**What to change:**
1. The trigger has **no `concurrency.runs: 1`** — multiple ADO item creates in the same
   polling window each spawn a separate parallel flow run
2. The `Apply_to_each` loop that calls `ChildFlow-ScheduleAPIs-PlannerTask` has
   **no `repetitions: 1`** — if a single ADO item matches multiple SP list rows (projects),
   it calls the child flow in parallel for each matching project

---

### Step-by-step portal instructions

#### Step 1 — Open the flow
1. Go to **make.powerautomate.com**
2. Navigate to **My flows** → find **2PLANNER-NewWorkItemIsCreated-withoutfilters**
3. Click **Edit**

#### Step 2 — Limit trigger concurrency to 1
1. Click on the **trigger** at the very top of the flow
   (it says "When a work item is created" — ADO connector)
2. Click the **...** (three dots) on the trigger card
3. Click **Settings**
4. Under **Concurrency Control** — toggle the switch **ON**
5. Set the **Limit** to **1**
6. Click **Done**

> **Note:** Setting runs to 1 means if multiple ADO items are created simultaneously, this
> flow will process them one at a time (the extras queue up). This is safe — no items are
> lost, they are queued.

#### Step 3 — Serialize the `Apply_to_each` loop
1. Find the **Apply_to_each** loop (iterates over `outputs('Get_items')?['body/value']` —
   matching SP list rows)
2. Click **...** on the loop card → **Settings**
3. Toggle **Concurrency Control** → **ON**
4. Set **Degree of Parallelism** to **1**
5. Click **Done**

#### Step 4 — Save
1. Click **Save**

---

---

# FIX 5 — `AssignResourceFromSPList`

**Flow ID:** A2979AF6-7A19-F111-8342-000D3AB2C546
**Used by:** SP list item created/modified trigger (automated)
**Child flow called:** `ScheduleAPIs-DraftResourceAssignment` (B717670B)

**What to change:**
1. The trigger has **no `concurrency.runs: 1`**
2. The `Apply_to_each` loop (over `triggerOutputs()?['body/Resource']` array) has
   **no `repetitions: 1`**

> **Note:** Confirm whether `ScheduleAPIs-DraftResourceAssignment` (B717670B) uses
> `CreateOperationSetV1`. If it only does direct resource assignment via Dataverse without
> an OperationSet, the risk is lower — but serializing the loop is still good practice to
> avoid API throttling.

---

### Step-by-step portal instructions

#### Step 1 — Open the flow
1. Go to **make.powerautomate.com**
2. Navigate to **My flows** → find **AssignResourceFromSPList**
3. Click **Edit**

#### Step 2 — Limit trigger concurrency to 1
1. Click on the **trigger** at the top
   (it says "When an item is created or modified" — SharePoint connector)
2. Click **...** → **Settings**
3. Toggle **Concurrency Control** → **ON**
4. Set **Limit** to **1**
5. Click **Done**

#### Step 3 — Serialize the `Apply_to_each` loop
1. Find the **Apply_to_each** loop inside the `Condition_2` block
   (iterates over `triggerOutputs()?['body/Resource']`)
2. Click **...** on the loop card → **Settings**
3. Toggle **Concurrency Control** → **ON**
4. Set **Degree of Parallelism** to **1**
5. Click **Done**

#### Step 4 — Save
1. Click **Save**

---

---

# Verification Checklist — After all fixes are applied

Run through this checklist to confirm everything is working correctly:

### ChildFlow-PlannerTask-CreateUpdate (FFC9CF08)
- [ ] `Delay_-_Persist_to_Dataverse` (40 s action) is deleted
- [ ] `Get_OperationSet` (standalone, outside loop) is deleted
- [ ] `Initialize_varOpSetStatus` variable (Integer, 0) exists before the Do Until
- [ ] `Poll_Until_OperationSet_Done` Do Until exists with exit condition checking `varOpSetStatus`
- [ ] Loop limit: Count 20, Timeout PT15M
- [ ] Inside loop: Delay 15s → Get_OperationSet_Poll (Dataverse) → Set_varOpSetStatus
- [ ] `Did_OperationSet_succeed` condition checks `variables('varOpSetStatus')` = 192350003
- [ ] Terminate message in False branch references `varOpSetStatus`

### ChildFlow-ScheduleAPIs-PlannerTask (FCD62B40)
- [ ] `Delay_-_Persist_to_Dataverse` (40 s action) is deleted
- [ ] `Get_OperationSet` (standalone) is deleted
- [ ] `Initialize_varOpSetStatus` variable (Integer, 0) exists
- [ ] `Poll_Until_OperationSet_Done` Do Until exists
- [ ] Loop limit: Count 20, Timeout PT15M
- [ ] Inside loop: Delay 15s → Get_OperationSet_Poll → Set_varOpSetStatus
- [ ] `Did_OperationSet_succeed` checks `variables('varOpSetStatus')` = 192350003

### PlannerDevOpsIntegration-Sync (33C494CA)
- [ ] `Apply_to_each` loop → Settings → Concurrency Control ON → Degree of Parallelism = 1

### 2PLANNER-NewWorkItemIsCreated-withoutfilters (AC7D2707)
- [ ] Trigger → Settings → Concurrency Control ON → Limit = 1
- [ ] `Apply_to_each` loop → Settings → Concurrency Control ON → Degree of Parallelism = 1

### AssignResourceFromSPList (A2979AF6)
- [ ] Trigger → Settings → Concurrency Control ON → Limit = 1
- [ ] `Apply_to_each` loop → Settings → Concurrency Control ON → Degree of Parallelism = 1

---

# OperationSet Status Code Reference

| Code | Meaning |
|------|---------|
| 192350000 | Not Started |
| 192350001 | In Progress |
| 192350002 | Failed (terminal — exit loop) |
| 192350003 | Completed (terminal — success — exit loop) |
| 192350004 | Aborted |

The polling loop exits when status is either **192350002** or **192350003** (both are terminal).
The `Did_OperationSet_succeed` condition then determines if it succeeded (192350003) or failed.

---

# Order of applying fixes (recommended)

Apply in this order to minimise risk:

1. **Fix 2 first** — `ChildFlow-ScheduleAPIs-PlannerTask` (polling loop)
   — Fixes the child before touching the parents that call it.

2. **Fix 1 second** — `ChildFlow-PlannerTask-CreateUpdate` (polling loop)
   — Same reason.

3. **Fix 3** — `PlannerDevOpsIntegration-Sync` (serialize loop)
   — Highest-risk parent. Apply after child is fixed.

4. **Fix 4** — `2PLANNER-NewWorkItemIsCreated-withoutfilters` (trigger + loop)

5. **Fix 5** — `AssignResourceFromSPList` (trigger + loop)
