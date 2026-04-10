import { IGanttTask, IGanttColumnConfig, getStatusClass, formatDateForGantt } from "./types";

type DataSet = ComponentFramework.PropertyTypes.DataSet;

interface ITreeEntry {
  recordId: string;
  parentId: string | null;
  sortOrder: number;
  children: ITreeEntry[];
}

/**
 * Map PCF dataset rows to frappe-gantt task objects.
 * Handles tree ordering if outlineLevelColumn, parentIdColumn, sortOrderColumn are provided.
 * Summary tasks (parents) get aggregated start/end/progress from children.
 */
export function mapDatasetToGanttTasks(
  dataset: DataSet,
  config: IGanttColumnConfig
): IGanttTask[] {
  if (!dataset?.sortedRecordIds || dataset.sortedRecordIds.length === 0) {
    return [];
  }

  const isTreeMode = !!(config.outlineLevelColumn && config.parentIdColumn && config.sortOrderColumn);

  // First pass: extract raw task data from dataset
  const rawTasks: IGanttTask[] = [];

  for (const recordId of dataset.sortedRecordIds) {
    const record = dataset.records[recordId];
    if (!record) continue;

    const title = record.getFormattedValue(config.taskTitleColumn) || "Untitled";
    const startRaw = record.getValue(config.startDateColumn);
    const endRaw = record.getValue(config.endDateColumn);
    const start = formatDateForGantt(startRaw);
    const end = formatDateForGantt(endRaw);

    // Skip tasks without dates (can't render on timeline)
    if (!start || !end) continue;

    const progress = config.percentCompleteColumn
      ? Number(record.getValue(config.percentCompleteColumn)) || 0
      : 0;

    // Parse predecessor dependencies
    let dependencies = "";
    if (config.predecessorColumn) {
      const predRaw = record.getFormattedValue(config.predecessorColumn) || "";
      // Extract numeric IDs, strip dependency type suffixes (FS, SS, etc.)
      dependencies = predRaw
        .split(/[,;]/)
        .map((s: string) => s.trim().replace(/[A-Za-z+\-\d]*$/, "").trim())
        .filter((s: string) => s.length > 0)
        .join(", ");
    }

    const status = config.statusColumn
      ? record.getFormattedValue(config.statusColumn) || ""
      : "";
    const customClass = getStatusClass(status);

    const depth = config.outlineLevelColumn
      ? (Number(record.getValue(config.outlineLevelColumn)) || 1) - 1
      : 0;

    // Indent task name by depth
    const indentPrefix = depth > 0 ? "\u00A0\u00A0".repeat(depth) + "└\u00A0" : "";

    rawTasks.push({
      id: recordId,
      name: indentPrefix + title,
      start,
      end,
      progress: Math.max(0, Math.min(100, progress)),
      dependencies,
      custom_class: customClass,
      _depth: depth,
      _hasChildren: false,
      _recordId: recordId,
    });
  }

  if (!isTreeMode) {
    return rawTasks;
  }

  // Tree mode: reorder by parent-child hierarchy
  const taskMap = new Map<string, IGanttTask>();
  for (const t of rawTasks) {
    taskMap.set(t.id, t);
  }

  // Build tree entries
  const childMap = new Map<string, ITreeEntry[]>();
  const rootEntries: ITreeEntry[] = [];

  for (const recordId of dataset.sortedRecordIds) {
    const record = dataset.records[recordId];
    if (!record || !taskMap.has(recordId)) continue;

    const parentIdRaw = record.getValue(config.parentIdColumn!);
    let parentIdStr: string | null = null;
    if (parentIdRaw != null && parentIdRaw !== "" && parentIdRaw !== 0) {
      parentIdStr = typeof parentIdRaw === "object" ? JSON.stringify(parentIdRaw) : `${parentIdRaw as string | number}`;
    }
    const sortOrder = config.sortOrderColumn
      ? Number(record.getValue(config.sortOrderColumn)) || 0
      : 0;

    const entry: ITreeEntry = { recordId, parentId: parentIdStr, sortOrder, children: [] };

    if (parentIdStr === null) {
      rootEntries.push(entry);
    } else {
      const siblings = childMap.get(parentIdStr) ?? [];
      siblings.push(entry);
      childMap.set(parentIdStr, siblings);
    }
  }

  // Sort siblings
  const sortEntries = (entries: ITreeEntry[]) =>
    entries.sort((a, b) => a.sortOrder - b.sortOrder);

  sortEntries(rootEntries);
  for (const children of childMap.values()) {
    sortEntries(children);
  }

  // Mark parents
  for (const parentId of childMap.keys()) {
    const task = taskMap.get(parentId);
    if (task) task._hasChildren = true;
  }

  // DFS to build ordered list
  const ordered: IGanttTask[] = [];
  const visit = (entries: ITreeEntry[]) => {
    for (const entry of entries) {
      const task = taskMap.get(entry.recordId);
      if (task) {
        // Summary task: aggregate children dates/progress
        const children = childMap.get(entry.recordId);
        if (children && children.length > 0) {
          task.custom_class += " gantt-bar-summary";
          aggregateSummaryTask(task, children, taskMap);
        }
        ordered.push(task);
      }
      const children = childMap.get(entry.recordId);
      if (children) visit(children);
    }
  };

  visit(rootEntries);

  // Append orphans (parentId doesn't match any row)
  const orderedIds = new Set(ordered.map((t) => t.id));
  for (const task of rawTasks) {
    if (!orderedIds.has(task.id)) {
      ordered.push(task);
    }
  }

  return ordered;
}

/**
 * Aggregate a summary task's start, end, and progress from its children.
 */
function aggregateSummaryTask(
  parent: IGanttTask,
  childEntries: ITreeEntry[],
  taskMap: Map<string, IGanttTask>
): void {
  let minStart = parent.start;
  let maxEnd = parent.end;
  let totalProgress = 0;
  let childCount = 0;

  for (const entry of childEntries) {
    const child = taskMap.get(entry.recordId);
    if (!child) continue;
    if (child.start < minStart) minStart = child.start;
    if (child.end > maxEnd) maxEnd = child.end;
    totalProgress += child.progress;
    childCount++;
  }

  parent.start = minStart;
  parent.end = maxEnd;
  parent.progress = childCount > 0 ? Math.round(totalProgress / childCount) : 0;
}
