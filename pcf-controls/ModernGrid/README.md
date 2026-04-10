# 📋 Resource Assignment Table — PCF Control

A fully interactive Power Apps Component Framework (PCF) control for assigning resources to tasks. Built with React and TypeScript, designed for SharePoint-backed Canvas Apps.

## ✨ Features

- **Resizable columns** — Drag column edges to adjust widths (persisted to localStorage)
- **Sortable columns** — Click any header to cycle through ascending → descending → none
- **Filterable columns** — Checkbox filter popovers on Priority, Status, and Resources columns
- **Global search** — Search across task names, resource names, and roles
- **Multi-select resource assignment** — Searchable dropdown with avatar chips and role labels
- **SharePoint integration** — Reads/writes to SharePoint lists via the PCF dataset binding

---

## 📁 Project Structure

```
ResourceAssignmentTable/
├── ResourceAssignmentTable/          # PCF control source
│   ├── ControlManifest.Input.xml     # Component manifest (properties, datasets)
│   ├── index.ts                      # PCF lifecycle entry point
│   ├── components/                   # React components
│   │   ├── ResourceTable.tsx         # Main table orchestrator
│   │   ├── ResizableHeader.tsx       # Header cell (resize + sort + filter)
│   │   ├── MultiSelectDropdown.tsx   # Multi-select resource picker
│   │   ├── FilterPopover.tsx         # Column filter checkboxes
│   │   └── ResourceChip.tsx          # Person avatar chip
│   ├── hooks/                        # Custom React hooks
│   │   ├── useColumnResize.ts        # Column drag-resize logic
│   │   └── useSortFilter.ts          # Sort, filter, search state
│   ├── utils/                        # Shared types & helpers
│   │   ├── types.ts                  # Interfaces, configs, column defs
│   │   └── helpers.ts                # Sort/filter/format utilities
│   ├── css/
│   │   └── ResourceAssignmentTable.css
│   └── generated/
│       └── ManifestTypes.d.ts        # Auto-generated type stubs
├── package.json
├── tsconfig.json
├── pcfproj                           # MSBuild project file
└── .eslintrc.json
```

---

## 🚀 Prerequisites

1. **Node.js** 18+ — [Download](https://nodejs.org/)
2. **Power Platform CLI** — Install via:
   ```bash
   npm install -g pac
   ```
   Or use the VS Code extension: **Power Platform Tools**
3. **.NET SDK 6.0+** — Required for `msbuild`
   [Download](https://dotnet.microsoft.com/download/dotnet/6.0)
4. **A Power Platform environment** with a solution to import the control into

---

## 🔧 Setup & Development

### 1. Install dependencies
```bash
cd ResourceAssignmentTable
npm install
```

### 2. Regenerate manifest types
```bash
npm run refreshTypes
```
This regenerates `generated/ManifestTypes.d.ts` from your `ControlManifest.Input.xml`.

### 3. Start the test harness
```bash
npm start
# or with file watching:
npm run start:watch
```
This opens a local browser with the PCF test harness where you can provide mock data and test the control.

### 4. Build for production
```bash
npm run build
```

---

## 📦 Packaging & Deployment

### Step 1: Create a Solution project
In a separate directory (sibling to the control):

```bash
mkdir ResourceAssignmentTableSolution
cd ResourceAssignmentTableSolution
pac solution init --publisher-name YourPublisher --publisher-prefix yourprefix
```

### Step 2: Add the control reference
```bash
pac solution add-reference --path ../ResourceAssignmentTable
```

### Step 3: Build the solution
```bash
dotnet build
# or
msbuild /t:build /restore
```

This produces a `.zip` file in `bin/Debug/` that you can import into Power Platform.

### Step 4: Import into Power Platform
Option A — Via CLI:
```bash
pac auth create --environment https://yourorg.crm.dynamics.com
pac solution import --path bin/Debug/ResourceAssignmentTableSolution.zip
```

Option B — Via the Power Platform admin center:
1. Go to make.powerapps.com → Solutions → Import
2. Upload the `.zip` file
3. Publish all customizations

---

## 🔗 SharePoint List Configuration

### Tasks List
Create a SharePoint list called **Tasks** with these columns:

| Column Name        | Type               | Notes                                |
|--------------------|--------------------|--------------------------------------|
| Title              | Single line text   | Task name (built-in Title column)    |
| Priority           | Choice             | Values: High, Medium, Low            |
| Status             | Choice             | Values: Not Started, In Progress, Completed |
| DueDate            | Date               | Date only                            |
| AssignedResources  | Person (multiple)  | Allow multiple selections            |

**Alternative for AssignedResources**: If you need more flexibility, use a **Single line of text** column that stores resource IDs as a JSON array (e.g., `["1","5","8"]`). The control handles both formats.

### Resources List (Optional)
If you want a dedicated resources list:

| Column Name | Type             | Notes                       |
|-------------|------------------|-----------------------------|
| Title       | Single line text | Full name                   |
| Role        | Choice or text   | Developer, Designer, PM, etc.|
| Email       | Single line text | Email address               |

Set the `resourceListName` property on the control to point to this list.

---

## ⚙️ Using in a Canvas App

### 1. Add the control to your app
1. Open your Canvas App in edit mode
2. Go to **Insert** → **Get more components** → **Code**
3. Select **ResourceAssignmentTable**
4. Drag it onto your screen

### 2. Bind the dataset
In the control's properties panel:

```
Items = Tasks                          // Your SharePoint list
Fields:
  taskTitle      → Title
  taskPriority   → Priority
  taskStatus     → Status  
  taskDueDate    → DueDate
  assignedResources → AssignedResources
```

### 3. Configure options
```
enableResize   = true
enableSort     = true
enableFilter   = true
enableSearch   = true
tableHeight    = 500                   // Set 0 for auto-height
resourceListName = "Resources"         // Optional: name of your resources list
```

### 4. Handle the output event
You can react to resource changes in Power Fx:

```
// In the OnChange property of the control:
Set(
    varLastChange,
    Self.onResourceChange
);

// This gives you a JSON string like:
// {"taskId":"3","resourceIds":"[\"1\",\"5\"]","timestamp":"2026-03-02T..."}
```

---

## 🧪 Testing with Mock Data

When you run `npm start`, the test harness opens. You can paste sample data into the dataset input. Here's a sample CSV you can use:

```csv
taskTitle,taskPriority,taskStatus,taskDueDate,assignedResources
Design login screen,High,In Progress,2026-03-10,"[""1"",""2""]"
Build API endpoints,High,Not Started,2026-03-15,"[""5""]"
Write test cases,Medium,Not Started,2026-03-18,"[]"
Setup CI/CD pipeline,Low,Completed,2026-03-08,"[""6"",""1""]"
```

---

## 🛠 Customization

### Adding new columns
1. Add a `<property-set>` to `ControlManifest.Input.xml`
2. Add an `IColumnDef` entry in `utils/types.ts` → `DEFAULT_COLUMNS`
3. Add a `case` in `ResourceTable.tsx` → `renderCell()`
4. Run `npm run refreshTypes` to update the generated types

### Changing colors / styling
Edit `utils/types.ts` → `PRIORITY_CONFIG` and `STATUS_CONFIG` for badge colors. Edit `css/ResourceAssignmentTable.css` for global styles.

### Changing the resource data source
Edit `index.ts` → `loadResourcesFromSharePoint()` to fetch from your preferred source (Dataverse WebAPI, SharePoint REST, Microsoft Graph, etc.).

---

## 📋 Troubleshooting

| Issue | Solution |
|-------|---------|
| Control doesn't appear in Canvas App | Make sure the solution is imported and published. Check that the control is enabled for Canvas Apps in the solution. |
| Resources column shows IDs not names | Configure the `resourceListName` property or ensure your Person column is properly mapped. |
| Column widths reset on page reload | Check that localStorage is accessible. The control persists widths to `pcf_resource_table_col_widths`. |
| Filter shows no options | Ensure the `filterOptions` array is populated in `DEFAULT_COLUMNS` for the relevant column. |
| Build fails with type errors | Run `npm run refreshTypes` to regenerate `ManifestTypes.d.ts`. |

---

## 📄 License

MIT — Use freely in your Power Apps projects.
