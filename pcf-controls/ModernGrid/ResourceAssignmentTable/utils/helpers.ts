import { IRow, IResource, ISortState, IFilterState, IColumnDef } from "./types";

/**
 * Get initials from a full name
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format a date string for display
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return "\u2014";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

/**
 * Apply search filter to rows.
 * Searches across ALL formatted column values and resource names.
 */
export function applySearch(
  rows: IRow[],
  searchText: string,
  resources: IResource[]
): IRow[] {
  if (!searchText.trim()) return rows;
  const q = searchText.toLowerCase().trim();

  return rows.filter((row) => {
    // Search all formatted values
    const matchesValue = Object.values(row.formattedValues).some(
      (val) => val && val.toLowerCase().includes(q)
    );
    if (matchesValue) return true;

    // Search resource names
    if (row.resourceIds.length > 0) {
      return row.resourceIds.some((rid) => {
        const r = resources.find((res) => res.id === rid);
        return (
          r?.name.toLowerCase().includes(q) ||
          r?.role?.toLowerCase().includes(q)
        );
      });
    }

    return false;
  });
}

/**
 * Apply column filters to rows.
 * Generic: works with any column key by checking formattedValues.
 */
export function applyFilters(
  rows: IRow[],
  filters: IFilterState,
  resources: IResource[],
  resourceColumnKey?: string
): IRow[] {
  let result = rows;

  for (const [columnKey, selectedValues] of Object.entries(filters)) {
    if (!selectedValues || selectedValues.length === 0) continue;

    if (columnKey === resourceColumnKey) {
      // Special handling for resource column
      result = result.filter((row) => {
        if (selectedValues.includes("Unassigned") && row.resourceIds.length === 0) {
          return true;
        }
        return row.resourceIds.some((rid) => {
          const r = resources.find((res) => res.id === rid);
          return r && selectedValues.includes(r.name);
        });
      });
    } else {
      // Generic filter: match formatted value
      result = result.filter((row) => {
        const val = row.formattedValues[columnKey] || "";
        return selectedValues.includes(val);
      });
    }
  }

  return result;
}

/**
 * Apply sorting to rows.
 * Uses column definitions to determine sort strategy by data type.
 */
export function applySorting(
  rows: IRow[],
  sort: ISortState,
  columns: IColumnDef[]
): IRow[] {
  if (!sort.column || !sort.direction) return rows;

  const col = columns.find((c) => c.key === sort.column);
  if (!col) return rows;

  const sorted = [...rows];
  const dir = sort.direction === "asc" ? 1 : -1;
  const key = sort.column;

  sorted.sort((a, b) => {
    switch (col.cellType) {
      case "number": {
        const av = Number(a.values[key]) || 0;
        const bv = Number(b.values[key]) || 0;
        return dir * (av - bv);
      }

      case "date": {
        const ad = new Date(a.values[key]).getTime() || 0;
        const bd = new Date(b.values[key]).getTime() || 0;
        return dir * (ad - bd);
      }

      case "resources":
        return dir * (a.resourceIds.length - b.resourceIds.length);

      case "boolean": {
        const av = a.values[key] ? 1 : 0;
        const bv = b.values[key] ? 1 : 0;
        return dir * (av - bv);
      }

      case "text":
      case "optionset":
      default: {
        const av = (a.formattedValues[key] || "").toLowerCase();
        const bv = (b.formattedValues[key] || "").toLowerCase();
        return dir * av.localeCompare(bv);
      }
    }
  });

  return sorted;
}

/**
 * Persist column widths to localStorage
 */
export function saveColumnWidths(widths: Record<string, number>): void {
  try {
    localStorage.setItem("pcf_modern_table_col_widths", JSON.stringify(widths));
  } catch {
    // localStorage not available
  }
}

/**
 * Load column widths from localStorage
 */
export function loadColumnWidths(): Record<string, number> | null {
  try {
    const stored = localStorage.getItem("pcf_modern_table_col_widths");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}
