# OperationSet Limit Fix Guide
## Error: ScheduleAPI-OV-0004 — Maximum 10 operation sets per user

This guide walks through every portal change needed to fix the error.
**Do not edit any flow JSON files directly — apply all changes through the Power Automate portal.**

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

**Flow ID:** FFC9CF08-57FB-F011-8406-000D3AB2C546
**Used by:** SyncExceltoPlanner

**What to change:** Replace the single `Delay_-_Persist_to_Dataverse` (40 s) + single
`Get_OperationSet` check with a polling loop that waits until the OperationSet is truly closed.

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

### Step-by-step portal instructions

#### Step 1 — Open the flow
1. Go to **make.powerautomate.com**
2. Navigate to **My flows** → find **ChildFlow-PlannerTask-CreateUpdate**
3. Click **Edit**

#### Step 2 — Delete `Delay_-_Persist_to_Dataverse`
1. Scroll down to find the action named **Delay - Persist to Dataverse**
   (it shows as a clock/delay icon, description says 40 Seconds)
2. Click the **...** (three dots) on that action card
3. Click **Delete**
4. Confirm deletion

#### Step 3 — Delete `Get_OperationSet` (the standalone one, NOT inside any loop)
1. Find the action named **Get_OperationSet** that sits directly below where the Delay was
   (it uses Dataverse, entity = Operation Sets)
2. Click the **...** on that action card
3. Click **Delete**
4. Confirm deletion

> After deleting both, the `Did_OperationSet_succeed` condition will show a warning because
> its expression references the deleted `Get_OperationSet` output. That is expected — you will
> fix it in Step 7.

#### Step 4 — Add `Initialize variable` for polling status
1. Click the **+** (plus / Add an action) button that now appears between
   **Condition_1** and **Did_OperationSet_succeed**
2. Search for **Initialize variable** and select it
3. Configure:
   - **Name:** `varOpSetStatus`
   - **Type:** Integer
   - **Value:** `0`
4. Rename the action title to: `Initialize_varOpSetStatus`

#### Step 5 — Add `Do Until` loop (polling loop)
1. Click the **+** button below `Initialize_varOpSetStatus`
2. Search for **Do Until** under the **Control** category and select it
3. In the **Do Until** configuration panel, set the **loop-exit condition**:
   - Left side: click **Add**, choose **Expression**, type:
     ```
     variables('varOpSetStatus')
     ```
   - Operator: **is equal to**
   - Right side: type `192350003`
4. This alone exits only on Completed. To also exit on Failed (192350002), click
   **Add row** (or **Edit in advanced mode**) and use the expression directly:
   
   **Switch to expression mode** and type:
   ```
   @or(equals(variables('varOpSetStatus'), 192350003), equals(variables('varOpSetStatus'), 192350002))
   ```
   Set comparison: **is equal to** `true`

5. Set loop **Limits**:
   - Click **Settings** inside the Do Until card
   - **Count:** `20`
   - **Timeout:** `PT15M`  (15 minutes in ISO 8601 duration)
   - Click **Done**

6. Rename the Do Until to: `Poll_Until_OperationSet_Done`

#### Step 6 — Add actions INSIDE the Do Until loop

Click inside the Do Until loop body and add these 3 actions **in order**:

**Action 6a — Delay (15 seconds)**
1. Click **+** inside the loop
2. Search for **Delay** and select it (Control connector)
3. Set **Count:** `15`, **Unit:** `Second`
4. Rename to: `Delay_Poll_15s`

**Action 6b — Get the OperationSet row**
1. Click **+** below the Delay inside the loop
2. Search for **Get a row** and select the **Microsoft Dataverse (legacy)** version
   (same connector as the rest of the flow — `shared_commondataserviceforapps`)
3. Configure:
   - **Entity Name:** `Operation Sets` (type it and select `msdyn_operationsets`)
   - **Item ID:** click the expression/fx button and type:
     ```
     outputs('OperationSetId')
     ```
4. Rename to: `Get_OperationSet_Poll`

**Action 6c — Set the status variable**
1. Click **+** below `Get_OperationSet_Poll` inside the loop
2. Search for **Set variable** and select it
3. Configure:
   - **Name:** select `varOpSetStatus` from the dropdown
   - **Value:** click **Expression** and type:
     ```
     outputs('Get_OperationSet_Poll')?['body/msdyn_status']
     ```
4. Rename to: `Set_varOpSetStatus`

#### Step 7 — Update `Did_OperationSet_succeed` condition
1. Click on the **Did_OperationSet_succeed** condition card
2. The existing expression references the deleted `Get_OperationSet` — it shows an error
3. Delete the broken expression row
4. Add a new condition row:
   - Left side — Expression:
     ```
     variables('varOpSetStatus')
     ```
   - Operator: **is equal to**
   - Right side: `192350003`
5. This means: if the final status is Completed, take the Yes/True path

#### Step 8 — Also update the Terminate (False branch) error message
1. Inside the **Did_OperationSet_succeed** — **No/False** branch
2. Click on `Terminate_as_Failed_for_failed_PSS_persist`
3. Update the **Message** field to something more descriptive:
   ```
   OperationSet did not complete successfully. Final status: @{variables('varOpSetStatus')}
   ```

#### Step 9 — Save and test
1. Click **Save**
2. Test the flow with a single task (Create scenario) and verify:
   - The Do Until loop runs at least 1 iteration (waits for the OperationSet)
   - The loop exits with status 192350003
   - The Respond action returns a taskid

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
