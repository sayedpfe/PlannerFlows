import * as React from "react";
import {
  IRow,
  IResource,
  IColumnDef,
  ITreeNode,
  getBadgeColor,
  getPercentColor,
} from "../utils/types";
import { applySearch, applyFilters, applySorting, formatDate } from "../utils/helpers";
import { buildTreeOrder, filterVisibleRows } from "../utils/treeUtils";
import { useColumnResize } from "../hooks/useColumnResize";
import { useSortFilter } from "../hooks/useSortFilter";
import { useTreeState } from "../hooks/useTreeState";
import { ResizableHeader } from "./ResizableHeader";
import { MultiSelectDropdown } from "./MultiSelectDropdown";
import { EditableCell } from "./EditableCell";
import { TreeChevron } from "./TreeChevron";

export type { IRow, IResource };

export interface IProjectGridProps {
  rows: IRow[];
  columns: IColumnDef[];
  resources: IResource[];
  resourceColumnKey?: string;
  enableResize: boolean;
  enableSort: boolean;
  enableFilter: boolean;
  enableSearch: boolean;
  editableColumnKeys: Set<string>;
  tableHeight: number;
  // Tree/hierarchy
  outlineLevelKey?: string;
  parentIdKey?: string;
  sortOrderKey?: string;
  // Selection
  enableSelection?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  // Inline create
  enableInlineCreate?: boolean;
  onTaskCreate?: (payload: { parentId: string | null; title: string; outlineLevel: number }) => void;
  // Existing
  onResourceChange?: (rowId: string, resourceIds: string[]) => void;
  onCellChange?: (rowId: string, columnKey: string, newValue: string) => void;
  onPeopleSearchChange?: (query: string) => void;
  isSearchingAD?: boolean;
}

/**
 * Generic Modern Table component.
 *
 * Features:
 * - Dynamic columns from any data source
 * - Resizable columns (drag column edges)
 * - Sortable columns (click headers to cycle asc -> desc -> none)
 * - Filterable columns (checkbox popovers for OptionSet / resource columns)
 * - Global search across all column values
 * - Optional multi-select resource assignment with searchable dropdown
 */
export const ProjectGrid: React.FC<IProjectGridProps> = ({
  rows,
  columns,
  resources,
  resourceColumnKey,
  enableResize,
  enableSort,
  enableFilter,
  enableSearch,
  editableColumnKeys,
  tableHeight,
  outlineLevelKey,
  parentIdKey,
  sortOrderKey,
  enableSelection,
  onSelectionChange,
  enableInlineCreate,
  onTaskCreate,
  onResourceChange,
  onCellChange,
  onPeopleSearchChange,
  isSearchingAD,
}) => {
  const isTreeMode = !!(outlineLevelKey && parentIdKey && sortOrderKey);

  // Selection state
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Inline create state
  const [isCreating, setIsCreating] = React.useState(false);
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  // Enrich columns with dynamic filter options
  const enrichedColumns: IColumnDef[] = React.useMemo(() => {
    return columns.map((col) => {
      if (!col.filterable) return col;

      if (col.cellType === "resources") {
        return {
          ...col,
          filterOptions: ["Unassigned", ...resources.map((r) => r.name)],
        };
      }

      // For other filterable columns, extract unique values from the data
      const uniqueValues = new Set<string>();
      for (const row of rows) {
        const val = row.formattedValues[col.key];
        if (val) uniqueValues.add(val);
      }
      if (uniqueValues.size === 0 || uniqueValues.size > 50) {
        // Don't show filter if no values or too many unique values
        return { ...col, filterable: false };
      }
      return {
        ...col,
        filterOptions: Array.from(uniqueValues).sort(),
      };
    });
  }, [columns, resources, rows]);

  const { widths, startResize, isResizing } = useColumnResize(enrichedColumns);
  const {
    sort,
    filters,
    searchText,
    setSearchText,
    toggleSort,
    setFilter,
    clearAllFilters,
    activeFilterCount,
  } = useSortFilter();

  // Tree state (expand/collapse)
  const {
    expandedIds,
    toggleExpand,
    expandAll,
    collapseAll,
    isExpanded,
  } = useTreeState("moderntable");

  // Process rows: search -> filter -> tree order (or sort) -> render
  const processedData = React.useMemo(() => {
    let result = rows;
    result = applySearch(result, searchText, resources);
    result = applyFilters(result, filters, resources, resourceColumnKey);

    if (isTreeMode) {
      // Tree mode: build tree order then filter by expand/collapse state
      const treeNodes = buildTreeOrder(result, outlineLevelKey!, parentIdKey!, sortOrderKey!);
      const visibleNodes = filterVisibleRows(treeNodes, expandedIds);
      return { rows: visibleNodes.map((n) => n.row), treeNodes: visibleNodes };
    }

    // Flat mode: apply normal sorting
    result = applySorting(result, sort, enrichedColumns);
    return { rows: result, treeNodes: null as ITreeNode[] | null };
  }, [rows, searchText, filters, sort, resources, enrichedColumns, resourceColumnKey, isTreeMode, outlineLevelKey, parentIdKey, sortOrderKey, expandedIds]);

  const processedRows = processedData.rows;
  const treeNodes = processedData.treeNodes;

  // Get all parent IDs for collapse-all
  const allParentIds = React.useMemo(() => {
    if (!treeNodes) return [];
    return treeNodes.filter((n) => n.hasChildren).map((n) => n.row.id);
  }, [treeNodes]);

  // Render a table cell based on its column type
  const renderCell = (row: IRow, column: IColumnDef, colIndex: number, treeNode?: ITreeNode): React.ReactNode => {
    const rawValue = row.values[column.key];
    const displayValue = row.formattedValues[column.key] || "";
    const isEditable = editableColumnKeys.has(column.key) && column.cellType !== "resources";

    const wrapEditable = (content: React.ReactNode): React.ReactNode => {
      if (!isEditable || !onCellChange) return content;
      return (
        <EditableCell
          value={displayValue}
          rawValue={rawValue}
          cellType={column.cellType}
          options={column.filterOptions}
          onChange={(newValue) => onCellChange(row.id, column.key, newValue)}
        >
          {content}
        </EditableCell>
      );
    };

    // Tree chevron for first data column
    const treePrefix = (isTreeMode && colIndex === 0 && treeNode) ? (
      <TreeChevron
        isExpanded={isExpanded(row.id)}
        hasChildren={treeNode.hasChildren}
        depth={treeNode.depth}
        onToggle={() => toggleExpand(row.id)}
      />
    ) : null;

    switch (column.cellType) {
      case "text":
        return wrapEditable(
          <span
            style={{
              fontWeight: colIndex === 0 ? 600 : 400,
              color: colIndex === 0 ? "#1e293b" : "#334155",
              fontSize: 13,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
            }}
            title={displayValue}
          >
            {treePrefix}
            {displayValue}
          </span>
        );

      case "percent": {
        const numVal = Number(rawValue) || 0;
        const clampedVal = Math.max(0, Math.min(100, numVal));
        const barColor = getPercentColor(clampedVal);
        return wrapEditable(
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {treePrefix}
            <div
              style={{
                flex: 1,
                height: 16,
                background: "#f1f5f9",
                borderRadius: 8,
                overflow: "hidden",
                position: "relative",
                minWidth: 60,
              }}
            >
              <div
                style={{
                  width: `${clampedVal}%`,
                  height: "100%",
                  background: barColor,
                  borderRadius: 8,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: barColor,
                minWidth: 32,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {clampedVal}%
            </span>
          </div>
        );
      }

      case "number":
        return wrapEditable(
          <span
            style={{
              color: "#334155",
              fontSize: 13,
              fontVariantNumeric: "tabular-nums",
              display: "block",
              textAlign: "right",
            }}
          >
            {displayValue}
          </span>
        );

      case "date":
        return wrapEditable(
          <span style={{ color: "#64748b", fontSize: 12.5 }}>
            {formatDate(rawValue != null ? String(rawValue) : "")}
          </span>
        );

      case "boolean":
        return wrapEditable(
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              background: rawValue ? "#f0fdf4" : "#f1f5f9",
              color: rawValue ? "#16a34a" : "#475569",
              whiteSpace: "nowrap",
            }}
          >
            {displayValue || (rawValue ? "Yes" : "No")}
          </span>
        );

      case "optionset": {
        if (!displayValue) return wrapEditable(
          <span style={{ color: "#94a3b8", fontSize: 12 }}>-- Select --</span>
        );
        const colors = getBadgeColor(displayValue);
        return wrapEditable(
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              background: colors.bg,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              whiteSpace: "nowrap",
            }}
          >
            {displayValue}
          </span>
        );
      }

      case "resources":
        if (!onResourceChange) {
          return (
            <span style={{ color: "#334155", fontSize: 13 }}>{displayValue}</span>
          );
        }
        return (
          <MultiSelectDropdown
            resources={resources}
            selectedIds={row.resourceIds}
            onChange={(ids) => onResourceChange(row.id, ids)}
            onSearchChange={onPeopleSearchChange}
            isSearchingAD={isSearchingAD}
          />
        );

      default:
        return wrapEditable(
          <span
            style={{
              color: "#334155",
              fontSize: 13,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
            }}
            title={displayValue}
          >
            {displayValue}
          </span>
        );
    }
  };

  if (enrichedColumns.length === 0) {
    return (
      <div
        className="modern-table-root"
        style={{
          fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
          padding: 40,
          textAlign: "center",
          color: "#64748b",
          fontSize: 14,
          background: "#f8fafc",
          border: "2px dashed #cbd5e1",
          borderRadius: 12,
          minHeight: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 24, marginBottom: 8 }}>{"\uD83D\uDDC2\uFE0F"}</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Modern Table</div>
          <div>Set the <strong>Items</strong> property to a data source, then add fields.</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="modern-table-root"
      style={{
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 13,
        color: "#1e293b",
        userSelect: isResizing ? "none" : "auto",
      }}
    >
      {/* Toolbar: search + filter badge + clear */}
      {enableSearch && (
        <div
          className="modern-table__toolbar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderBottom: "1px solid #f1f5f9",
            flexWrap: "wrap",
          }}
        >
          {/* Search input */}
          <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 280 }}>
            <span
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 13,
                color: "#94a3b8",
                pointerEvents: "none",
              }}
            >
              {"\uD83D\uDD0D"}
            </span>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search..."
              style={{
                width: "100%",
                padding: "7px 12px 7px 32px",
                border: "1.5px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
                background: "#fff",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
              onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
            />
          </div>

          {/* Active filter count + clear button */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              style={{
                padding: "6px 12px",
                border: "1.5px solid #fca5a5",
                borderRadius: 8,
                background: "#fef2f2",
                color: "#dc2626",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                whiteSpace: "nowrap",
                transition: "background 0.15s",
              }}
            >
              {"\u2715"} Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
            </button>
          )}

          {/* Record count */}
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              fontSize: 11.5,
              color: "#2563eb",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {processedRows.length} / {rows.length} records
          </div>

          {/* Tree expand/collapse buttons */}
          {isTreeMode && (
            <>
              <button
                onClick={expandAll}
                style={{
                  padding: "6px 10px",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 8,
                  background: "#fff",
                  color: "#475569",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {"\u25BC"} Expand All
              </button>
              <button
                onClick={() => collapseAll(allParentIds)}
                style={{
                  padding: "6px 10px",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 8,
                  background: "#fff",
                  color: "#475569",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {"\u25B6"} Collapse All
              </button>
            </>
          )}
        </div>
      )}

      {/* Table */}
      <div
        className="modern-table__scroll"
        style={{
          overflowX: "auto",
          overflowY: tableHeight > 0 ? "auto" : "visible",
          maxHeight: tableHeight > 0 ? tableHeight : undefined,
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          {/* Column group for fixed widths */}
          <colgroup>
            {enableSelection && <col style={{ width: 40 }} />}
            {enrichedColumns.map((col) => (
              <col key={col.key} style={{ width: widths[col.key] || col.defaultWidth }} />
            ))}
          </colgroup>

          {/* Header row */}
          <thead>
            <tr>
              {enableSelection && (
                <th
                  style={{
                    width: 40,
                    padding: "10px 8px",
                    borderBottom: "2px solid #e2e8f0",
                    textAlign: "center",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={processedRows.length > 0 && selectedIds.size === processedRows.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const all = new Set(processedRows.map((r) => r.id));
                        setSelectedIds(all);
                        onSelectionChange?.(Array.from(all));
                      } else {
                        setSelectedIds(new Set());
                        onSelectionChange?.([]);
                      }
                    }}
                    style={{ cursor: "pointer", accentColor: "#3b82f6" }}
                  />
                </th>
              )}
              {enrichedColumns.map((col) => (
                <ResizableHeader
                  key={col.key}
                  column={col}
                  width={widths[col.key] || col.defaultWidth}
                  onResizeStart={startResize}
                  sortDirection={sort.column === col.key ? sort.direction : null}
                  onSort={() => toggleSort(col.key)}
                  activeFilters={filters}
                  onFilterChange={setFilter}
                  enableResize={enableResize}
                  enableSort={enableSort}
                  enableFilter={enableFilter}
                />
              ))}
            </tr>
          </thead>

          {/* Data rows */}
          <tbody>
            {processedRows.map((row, rowIndex) => {
              const treeNode = treeNodes ? treeNodes[rowIndex] : undefined;
              return (
              <tr
                key={row.id}
                className="table-row"
                style={{
                  transition: "background 0.1s",
                  background: selectedIds.has(row.id) ? "#eff6ff" : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!selectedIds.has(row.id))
                    (e.currentTarget as HTMLElement).style.background = "#fafbfe";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    selectedIds.has(row.id) ? "#eff6ff" : "transparent";
                }}
              >
                {enableSelection && (
                  <td style={{ padding: "8px", textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={(e) => {
                        const next = new Set(selectedIds);
                        if (e.target.checked) {
                          next.add(row.id);
                        } else {
                          next.delete(row.id);
                        }
                        setSelectedIds(next);
                        onSelectionChange?.(Array.from(next));
                      }}
                      style={{ cursor: "pointer", accentColor: "#3b82f6" }}
                    />
                  </td>
                )}
                {enrichedColumns.map((col, colIndex) => (
                  <td
                    key={col.key}
                    style={{
                      padding: col.cellType === "resources" ? "8px 10px" : "12px 12px",
                      borderBottom: "1px solid #f1f5f9",
                      overflow: "hidden",
                    }}
                  >
                    {renderCell(row, col, colIndex, treeNode)}
                  </td>
                ))}
              </tr>
              );
            })}

            {/* Empty state */}
            {processedRows.length === 0 && (
              <tr>
                <td
                  colSpan={enrichedColumns.length + (enableSelection ? 1 : 0)}
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: 14,
                  }}
                >
                  {rows.length === 0
                    ? "No records found in the data source"
                    : "No records match your current filters"}
                </td>
              </tr>
            )}

            {/* Inline create row */}
            {enableInlineCreate && onTaskCreate && (
              <tr>
                {enableSelection && <td style={{ borderBottom: "1px solid #f1f5f9" }} />}
                <td
                  colSpan={enrichedColumns.length}
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  {isCreating ? (
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newTaskTitle.trim()) {
                          onTaskCreate({
                            parentId: null,
                            title: newTaskTitle.trim(),
                            outlineLevel: 1,
                          });
                          setNewTaskTitle("");
                          setIsCreating(false);
                        }
                        if (e.key === "Escape") {
                          setNewTaskTitle("");
                          setIsCreating(false);
                        }
                      }}
                      onBlur={() => {
                        if (!newTaskTitle.trim()) {
                          setIsCreating(false);
                        }
                      }}
                      autoFocus
                      placeholder="Enter task title..."
                      style={{
                        width: "100%",
                        padding: "7px 12px",
                        border: "1.5px solid #3b82f6",
                        borderRadius: 6,
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => setIsCreating(true)}
                      style={{
                        background: "none",
                        border: "2px dashed #cbd5e1",
                        borderRadius: 6,
                        padding: "8px 16px",
                        color: "#64748b",
                        fontSize: 13,
                        cursor: "pointer",
                        width: "100%",
                        textAlign: "left",
                        transition: "border-color 0.15s, color 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "#3b82f6";
                        (e.currentTarget as HTMLElement).style.color = "#3b82f6";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "#cbd5e1";
                        (e.currentTarget as HTMLElement).style.color = "#64748b";
                      }}
                    >
                      {"＋ Add task"}
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
