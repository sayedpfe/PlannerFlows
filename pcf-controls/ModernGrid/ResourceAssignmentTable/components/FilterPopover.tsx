import * as React from "react";
import { IFilterState } from "../utils/types";

interface IFilterPopoverProps {
  columnKey: string;
  options: string[];
  activeFilters: IFilterState;
  onChange: (column: string, values: string[]) => void;
  onClose: () => void;
}

/**
 * A dropdown popover with checkboxes for filtering column values.
 * Supports multi-select and a "Clear filter" action.
 */
export const FilterPopover: React.FC<IFilterPopoverProps> = ({
  columnKey,
  options,
  activeFilters,
  onChange,
  onClose,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const active = activeFilters[columnKey] || [];

  const toggle = (val: string) => {
    const next = active.includes(val)
      ? active.filter((x) => x !== val)
      : [...active, val];
    onChange(columnKey, next);
  };

  return (
    <div
      ref={ref}
      className="filter-popover"
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        zIndex: 9999,
        minWidth: 180,
        background: "#fff",
        borderRadius: 10,
        boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
        border: "1px solid #e5e7eb",
        overflow: "hidden",
        animation: "pcf-fadeIn 0.12s ease-out",
      }}
      onClick={(e) => e.stopPropagation()} // Prevent sort toggle
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #f1f5f9",
          fontSize: 11,
          fontWeight: 700,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Filter by {columnKey}
      </div>

      {/* Options */}
      <div style={{ padding: 4 }}>
        {options.map((opt) => {
          const isActive = active.includes(opt);
          return (
            <div
              key={opt}
              onClick={() => toggle(opt)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                cursor: "pointer",
                borderRadius: 6,
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#f8fafc")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  flexShrink: 0,
                  border: isActive ? "none" : "2px solid #d1d5db",
                  background: isActive ? "#3b82f6" : "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s",
                }}
              >
                {isActive && <span style={{ color: "#fff", fontSize: 10, fontWeight: 800 }}>✓</span>}
              </div>
              <span style={{ fontSize: 12.5, color: "#334155" }}>{opt}</span>
            </div>
          );
        })}
      </div>

      {/* Clear button */}
      {active.length > 0 && (
        <div style={{ padding: "6px 8px", borderTop: "1px solid #f1f5f9" }}>
          <button
            onClick={() => onChange(columnKey, [])}
            style={{
              width: "100%",
              padding: 6,
              border: "none",
              borderRadius: 6,
              background: "#fef2f2",
              color: "#dc2626",
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.background = "#fee2e2")}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.background = "#fef2f2")}
          >
            Clear filter
          </button>
        </div>
      )}
    </div>
  );
};
