/**
 * Gantt-specific interfaces and configuration.
 */

export interface IGanttColumnConfig {
  taskTitleColumn: string;
  startDateColumn: string;
  endDateColumn: string;
  percentCompleteColumn?: string;
  predecessorColumn?: string;
  statusColumn?: string;
  outlineLevelColumn?: string;
  parentIdColumn?: string;
  sortOrderColumn?: string;
  baselineStartColumn?: string;
  baselineEndColumn?: string;
}

export interface IGanttTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies: string;
  custom_class: string;
  _depth: number;
  _hasChildren: boolean;
  _recordId: string;
}

/**
 * Map a status string to a CSS class for bar coloring.
 */
export function getStatusClass(status: string): string {
  if (!status) return "gantt-bar-default";
  const normalized = status.toLowerCase().replace(/\s+/g, "");
  switch (normalized) {
    case "completed":
      return "gantt-bar-completed";
    case "inprogress":
      return "gantt-bar-inprogress";
    case "blocked":
      return "gantt-bar-blocked";
    case "notstarted":
      return "gantt-bar-notstarted";
    case "cancelled":
      return "gantt-bar-cancelled";
    default:
      return "gantt-bar-default";
  }
}

/**
 * Format a Date to YYYY-MM-DD string for frappe-gantt.
 */
export function formatDateForGantt(dateValue: unknown): string {
  if (!dateValue) return "";
  try {
    const d = new Date(dateValue as string);
    if (isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return "";
  }
}

/**
 * Format a Date object to ISO date string for output.
 */
export function dateToISOString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
