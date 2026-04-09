# PCF Controls

Power Apps Component Framework controls for the Project Management solution.

## Controls

### ModernGrid (v4.0)
Enhanced interactive table with tree/hierarchy rendering, resizable columns, sorting, filtering, inline editing, resource assignment, progress bars, and row selection.

**Source:** `ModernGrid/ResourceAssignmentTable/`
**Build:** `cd ModernGrid && npm install && npm run build`

### GanttChart (v1.0)
Gantt chart visualization wrapping [frappe-gantt](https://github.com/nicedaycode/frappe-gantt) (MIT). Supports drag-resize, dependencies, view mode toggle, and baseline display.

**Source:** `GanttChart/GanttChart/`
**Build:** `cd GanttChart && npm install && npm run build`

### Solution Package
Combined solution package containing both controls.

**Build:** `cd Solution && dotnet build`
**Output:** `Solution/bin/Debug/Solution.zip`

## Prerequisites

- Node.js 18+
- Power Platform CLI (`npm install -g pac`)
- .NET SDK 6.0+

See [docs/architecture.md](../docs/architecture.md) sections 5–6 for implementation details.
