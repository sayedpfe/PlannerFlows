import * as React from "react";
import { IColumnDef, IFilterState } from "../utils/types";
import { FilterPopover } from "./FilterPopover";

interface IResizableHeaderProps {
  column: IColumnDef;
  width: number;
  onResizeStart: (columnKey: string, startX: number) => void;
  sortDirection: "asc" | "desc" | null;
  onSort: () => void;
  activeFilters: IFilterState;
  onFilterChange: (column: string, values: string[]) => void;
  enableResize: boolean;
  enableSort: boolean;
  enableFilter: boolean;
}

/**
 * A table header cell that supports:
 * - Drag-to-resize via a right-edge handle
 * - Click-to-sort with asc/desc/none cycling
 * - Filter popover with checkboxes
 */
export const ResizableHeader: React.FC<IResizableHeaderProps> = ({
  column,
  width,
  onResizeStart,
  sortDirection,
  onSort,
  activeFilters,
  onFilterChange,
  enableResize,
  enableSort,
  enableFilter,
}) => {
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [resizeHover, setResizeHover] = React.useState(false);

  const hasActiveFilter = (activeFilters[column.key] || []).length > 0;
  const isSortable = enableSort && column.sortable;
  const isFilterable = enableFilter && column.filterable && column.filterOptions;
  const isResizable = enableResize && column.resizable;

  const handleResizeMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onResizeStart(column.key, e.clientX);
    },
    [column.key, onResizeStart]
  );

  return (
    <th
      className="table-header"
      style={{
        width,
        minWidth: column.minWidth,
        maxWidth: width,
        position: "relative",
        padding: 0,
        userSelect: "none",
        borderBottom: "2px solid #e2e8f0",
        background: "#f8fafc",
      }}
    >
      {/* Header content: label + sort + filter icons */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "10px 12px",
          cursor: isSortable ? "pointer" : "default",
        }}
        onClick={isSortable ? onSort : undefined}
      >
        {/* Column label */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#475569",
            textTransform: "uppercase",
            letterSpacing: 0.7,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {column.label}
        </span>

        {/* Sort indicator */}
        {isSortable && (
          <span
            style={{
              fontSize: 10,
              color: sortDirection ? "#3b82f6" : "#cbd5e1",
              flexShrink: 0,
              transition: "color 0.15s",
            }}
          >
            {sortDirection === "asc" ? "▲" : sortDirection === "desc" ? "▼" : "⇅"}
          </span>
        )}

        {/* Filter button */}
        {isFilterable && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setFilterOpen(!filterOpen);
            }}
            style={{
              fontSize: 12,
              cursor: "pointer",
              flexShrink: 0,
              marginLeft: 2,
              color: hasActiveFilter ? "#3b82f6" : "#94a3b8",
              opacity: hasActiveFilter ? 1 : 0.6,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.opacity = "1")}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.opacity = hasActiveFilter ? "1" : "0.6")}
            title={`Filter by ${column.label}`}
          >
            {hasActiveFilter ? "⊜" : "⊙"}
          </span>
        )}
      </div>

      {/* Filter popover */}
      {filterOpen && isFilterable && (
        <FilterPopover
          columnKey={column.key}
          options={column.filterOptions!}
          activeFilters={activeFilters}
          onChange={onFilterChange}
          onClose={() => setFilterOpen(false)}
        />
      )}

      {/* Resize handle */}
      {isResizable && (
        <div
          className="resize-handle"
          onMouseDown={handleResizeMouseDown}
          onMouseEnter={() => setResizeHover(true)}
          onMouseLeave={() => setResizeHover(false)}
          style={{
            position: "absolute",
            right: 0,
            top: 4,
            bottom: 4,
            width: 6,
            cursor: "col-resize",
            borderRadius: 3,
            zIndex: 10,
            background: resizeHover ? "#94a3b8" : "transparent",
            transition: "background 0.15s",
          }}
        />
      )}
    </th>
  );
};
