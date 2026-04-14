/**
 * Represents a resource (person) that can be assigned to rows.
 */
export interface IResource {
  id: string;
  name: string;
  role: string;
  email?: string;
  color: string;
}

/**
 * Represents a generic data row in the table.
 * Works with any datasource — all column values are stored dynamically.
 */
export interface IRow {
  id: string;
  /** Raw values keyed by column name */
  values: Record<string, any>;
  /** Formatted display strings keyed by column name */
  formattedValues: Record<string, string>;
  /** Resource IDs (populated only when resourceColumnName is configured) */
  resourceIds: string[];
  /** Raw PCF record reference for write-back */
  _raw?: any;
}

/**
 * Supported cell rendering types
 */
export type CellType = "text" | "number" | "date" | "boolean" | "optionset" | "resources" | "percent";

/**
 * Column definition for the table
 */
export interface IColumnDef {
  key: string;
  label: string;
  dataType: string;
  defaultWidth: number;
  minWidth: number;
  sortable: boolean;
  filterable: boolean;
  resizable: boolean;
  filterOptions?: string[];
  editable?: boolean;
  cellType: CellType;
}

/**
 * Sort state
 */
export interface ISortState {
  column: string | null;
  direction: "asc" | "desc" | null;
}

/**
 * Filter state: column key -> selected filter values
 */
export type IFilterState = Record<string, string[]>;

/**
 * Person search result from Active Directory (via Office365Users connector)
 */
export interface IPersonSearchResult {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

/**
 * Default color palette for resource avatars
 */
export const RESOURCE_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#ef4444", "#06b6d4", "#f97316",
  "#84cc16", "#a855f7", "#14b8a6", "#e11d48",
];

/**
 * Color palette for auto-coloring OptionSet / badge values.
 * Each entry is { bg, text, border }.
 */
const BADGE_PALETTE = [
  { bg: "#fef2f2", text: "#dc2626", border: "#fca5a5" },
  { bg: "#fffbeb", text: "#d97706", border: "#fcd34d" },
  { bg: "#f0fdf4", text: "#16a34a", border: "#86efac" },
  { bg: "#eff6ff", text: "#2563eb", border: "#93c5fd" },
  { bg: "#fdf4ff", text: "#a855f7", border: "#d8b4fe" },
  { bg: "#fff7ed", text: "#ea580c", border: "#fdba74" },
  { bg: "#f0fdfa", text: "#0d9488", border: "#5eead4" },
  { bg: "#fdf2f8", text: "#db2777", border: "#f9a8d4" },
  { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
  { bg: "#ecfdf5", text: "#059669", border: "#6ee7b7" },
];

/**
 * Get a deterministic color set for any string value.
 * Uses a simple hash to pick from the BADGE_PALETTE so the same
 * value always gets the same color.
 */
export function getBadgeColor(value: string): { bg: string; text: string; border: string } {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % BADGE_PALETTE.length;
  return BADGE_PALETTE[idx];
}

/**
 * Map a PCF column dataType string to our CellType.
 */
export function mapDataTypeToCellType(
  dataType: string,
  isResourceColumn: boolean,
  isPercentColumn?: boolean
): CellType {
  if (isResourceColumn) return "resources";
  if (isPercentColumn) return "percent";

  switch (dataType) {
    case "SingleLine.Text":
    case "Multiple":
    case "SingleLine.Email":
    case "SingleLine.Phone":
    case "SingleLine.URL":
      return "text";

    case "Whole.None":
    case "Decimal":
    case "Currency":
    case "FP":
      return "number";

    case "DateAndTime.DateOnly":
    case "DateAndTime.DateAndTime":
      return "date";

    case "TwoOptions":
      return "boolean";

    case "OptionSet":
    case "MultiSelectOptionSet":
      return "optionset";

    default:
      return "text";
  }
}

/**
 * Get a sensible default column width based on cell type.
 */
export function getDefaultWidth(cellType: CellType): number {
  switch (cellType) {
    case "resources": return 280;
    case "percent": return 130;
    case "date": return 120;
    case "number": return 100;
    case "boolean": return 90;
    case "optionset": return 130;
    case "text":
    default:
      return 180;
  }
}

/**
 * Get a sensible minimum column width based on cell type.
 */
export function getMinWidth(cellType: CellType): number {
  switch (cellType) {
    case "resources": return 180;
    case "percent": return 90;
    case "date": return 90;
    case "number": return 70;
    case "boolean": return 70;
    case "optionset": return 90;
    case "text":
    default:
      return 100;
  }
}

/**
 * Get the progress bar color based on percentage value.
 */
export function getPercentColor(value: number): string {
  if (value >= 100) return "#16a34a";
  if (value >= 67) return "#3b82f6";
  if (value >= 34) return "#f59e0b";
  return "#ef4444";
}
