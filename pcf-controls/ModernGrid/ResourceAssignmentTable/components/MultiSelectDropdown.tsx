import * as React from "react";
import { IResource } from "../utils/types";
import { getInitials } from "../utils/helpers";
import { ResourceChip } from "./ResourceChip";

interface IMultiSelectDropdownProps {
  resources: IResource[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onSearchChange?: (query: string) => void;
  isSearchingAD?: boolean;
}

/**
 * A searchable multi-select dropdown for resource assignment.
 * Shows selected resources as chips with remove buttons.
 * Dropdown includes search, checkboxes, and role labels.
 */
export const MultiSelectDropdown: React.FC<IMultiSelectDropdownProps> = ({
  resources,
  selectedIds,
  onChange,
  onSearchChange,
  isSearchingAD,
}) => {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [dropdownPos, setDropdownPos] = React.useState<{ top: number; left: number } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable ref for the callback — prevents re-render loops when Power Apps
  // calls updateView() and creates a new function reference
  const onSearchChangeRef = React.useRef(onSearchChange);
  onSearchChangeRef.current = onSearchChange;

  // Debounced AD search callback — only depends on `search`, NOT on the callback ref
  React.useEffect(() => {
    if (!onSearchChangeRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        onSearchChangeRef.current?.(search.trim());
      }, 300);
    } else if (search.trim().length === 0) {
      onSearchChangeRef.current("");
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Also check if clicking inside the fixed dropdown portal
        const dropdown = document.getElementById("msde-dropdown-portal");
        if (dropdown && dropdown.contains(e.target as Node)) return;
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Find the offset caused by any CSS transform ancestor (breaks position:fixed in Power Apps)
  const getTransformOffset = React.useCallback((el: HTMLElement): { x: number; y: number } => {
    let current: HTMLElement | null = el.parentElement;
    while (current && current !== document.body && current !== document.documentElement) {
      const style = window.getComputedStyle(current);
      if (
        (style.transform && style.transform !== "none") ||
        (style.willChange && style.willChange.includes("transform")) ||
        style.contain === "paint"
      ) {
        const r = current.getBoundingClientRect();
        return { x: r.left, y: r.top };
      }
      current = current.parentElement;
    }
    return { x: 0, y: 0 };
  }, []);

  // Recalculate dropdown position from trigger's current viewport rect
  const recalcPosition = React.useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const offset = getTransformOffset(triggerRef.current);
      const dropdownHeight = 320;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < dropdownHeight
        ? rect.top - offset.y - dropdownHeight - 4
        : rect.bottom - offset.y + 4;
      setDropdownPos({ top, left: rect.left - offset.x });
    }
  }, [getTransformOffset]);

  // Calculate position on open, reposition on scroll/resize, focus search
  React.useEffect(() => {
    if (!open) return;
    recalcPosition();
    if (searchRef.current) {
      searchRef.current.focus();
    }
    // Close dropdown on external scroll (table or page) but NOT on scroll within the dropdown itself
    const onScroll = (e: Event) => {
      const dropdownEl = document.getElementById("msde-dropdown-portal");
      if (dropdownEl && dropdownEl.contains(e.target as Node)) return; // ignore dropdown's own scroll
      setOpen(false);
      setSearch("");
    };
    // Listen on capture phase to catch scrolls inside the table container
    document.addEventListener("scroll", onScroll as EventListener, true);
    window.addEventListener("resize", recalcPosition);
    return () => {
      document.removeEventListener("scroll", onScroll as EventListener, true);
      window.removeEventListener("resize", recalcPosition);
    };
  }, [open, recalcPosition]);

  const filtered = React.useMemo(
    () =>
      resources.filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.role?.toLowerCase().includes(search.toLowerCase()) ||
          r.email?.toLowerCase().includes(search.toLowerCase())
      ),
    [resources, search]
  );

  const toggle = React.useCallback(
    (id: string) => {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id];
      onChange(next);
    },
    [selectedIds, onChange]
  );

  const selectedResources = selectedIds
    .map((id) => resources.find((r) => r.id === id))
    .filter(Boolean) as IResource[];

  return (
    <div ref={containerRef} className="multi-select" style={{ position: "relative", width: "100%", minWidth: 0 }}>
      {/* Trigger area - shows chips or placeholder */}
      <div
        ref={triggerRef}
        className="multi-select__trigger"
        onClick={() => setOpen(!open)}
        style={{
          minHeight: 32,
          padding: "3px 6px",
          border: open ? "2px solid #3b82f6" : "1.5px solid transparent",
          borderRadius: 7,
          cursor: "pointer",
          display: "flex",
          flexWrap: "wrap",
          gap: 3,
          alignItems: "center",
          background: open ? "#fff" : "transparent",
          transition: "all 0.15s ease",
          boxShadow: open ? "0 0 0 3px rgba(59,130,246,0.12)" : "none",
        }}
      >
        {selectedResources.length === 0 && (
          <span style={{ color: "#b0b8c4", fontSize: 12, padding: "0 4px" }}>+ Assign...</span>
        )}
        {selectedResources.map((r) => (
          <ResourceChip key={r.id} resource={r} onRemove={toggle} small />
        ))}
      </div>

      {/* Dropdown panel - uses fixed positioning to escape overflow:auto containers */}
      {open && dropdownPos && (
        <div
          id="msde-dropdown-portal"
          className="multi-select__dropdown"
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: 270,
            zIndex: 9999,
            background: "#fff",
            borderRadius: 10,
            boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)",
            border: "1px solid #e5e7eb",
            overflow: "hidden",
            animation: "pcf-fadeIn 0.12s ease-out",
          }}
        >
          {/* Search input */}
          <div style={{ padding: 6, borderBottom: "1px solid #f1f5f9" }}>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or role..."
              style={{
                width: "100%",
                padding: "7px 10px",
                border: "1.5px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 12.5,
                outline: "none",
                boxSizing: "border-box",
                background: "#f8fafc",
                transition: "border 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
              onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              onKeyDown={(e) => {
                // Select first result on Enter
                if (e.key === "Enter" && filtered.length > 0) {
                  toggle(filtered[0].id);
                }
                // Close on Escape
                if (e.key === "Escape") {
                  setOpen(false);
                  setSearch("");
                }
              }}
            />
          </div>

          {/* Resource list */}
          <div style={{ maxHeight: 200, overflowY: "auto", padding: 3 }}>
            {filtered.map((r) => {
              const isSelected = selectedIds.includes(r.id);
              return (
                <div
                  key={r.id}
                  className="multi-select__option"
                  onClick={() => toggle(r.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    cursor: "pointer",
                    borderRadius: 6,
                    background: isSelected ? "#eff6ff" : "transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#f8fafc";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  {/* Checkbox */}
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 3,
                      flexShrink: 0,
                      border: isSelected ? "none" : "2px solid #d1d5db",
                      background: isSelected ? "#3b82f6" : "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s",
                    }}
                  >
                    {isSelected && <span style={{ color: "#fff", fontSize: 10, fontWeight: 800 }}>✓</span>}
                  </div>

                  {/* Avatar */}
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: r.color,
                      flexShrink: 0,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {getInitials(r.name)}
                  </div>

                  {/* Name + Role */}
                  <div style={{ minWidth: 0, overflow: "hidden" }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "#1e293b",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {r.name}
                    </div>
                    {r.role && (
                      <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{r.role}</div>
                    )}
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && !isSearchingAD && (
              <div style={{ padding: 16, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                {onSearchChange && search.trim().length >= 2
                  ? "No people found. Try a different search."
                  : "No resources found"}
              </div>
            )}
            {isSearchingAD && (
              <div style={{ padding: 12, textAlign: "center", color: "#3b82f6", fontSize: 12, fontWeight: 500 }}>
                Searching Active Directory...
              </div>
            )}
          </div>

          {/* Quick info */}
          <div
            style={{
              padding: "6px 10px",
              borderTop: "1px solid #f1f5f9",
              fontSize: 10.5,
              color: "#94a3b8",
              textAlign: "center",
            }}
          >
            {selectedIds.length} of {resources.length} assigned
            {onSearchChange && !search.trim() && (
              <span style={{ display: "block", marginTop: 2, fontSize: 10, color: "#bcc3ce" }}>
                Type to search Active Directory
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
