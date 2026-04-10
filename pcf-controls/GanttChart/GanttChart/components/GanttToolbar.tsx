import * as React from "react";

export interface IGanttToolbarProps {
  viewMode: string;
  onViewModeChange: (mode: string) => void;
  taskCount: number;
}

const VIEW_MODES = [
  { key: "Day", label: "Day" },
  { key: "Week", label: "Week" },
  { key: "Month", label: "Month" },
];

/**
 * Toolbar above the Gantt chart with view mode toggle buttons.
 */
export const GanttToolbar: React.FC<IGanttToolbarProps> = ({
  viewMode,
  onViewModeChange,
  taskCount,
}) => {
  return (
    <div
      className="gantt-toolbar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderBottom: "1px solid #e2e8f0",
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
        flexWrap: "wrap",
      }}
    >
      {/* View mode buttons */}
      <div
        style={{
          display: "inline-flex",
          borderRadius: 8,
          overflow: "hidden",
          border: "1.5px solid #e2e8f0",
        }}
      >
        {VIEW_MODES.map((mode) => (
          <button
            key={mode.key}
            onClick={() => onViewModeChange(mode.key)}
            style={{
              padding: "6px 14px",
              border: "none",
              borderRight: mode.key !== "Month" ? "1px solid #e2e8f0" : "none",
              background: viewMode === mode.key ? "#3b82f6" : "#fff",
              color: viewMode === mode.key ? "#fff" : "#475569",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Today button */}
      <button
        onClick={() => {
          const todayBar = document.querySelector(".today-highlight");
          if (todayBar) {
            todayBar.scrollIntoView({ behavior: "smooth", inline: "center" });
          }
        }}
        style={{
          padding: "6px 12px",
          border: "1.5px solid #e2e8f0",
          borderRadius: 8,
          background: "#fff",
          color: "#475569",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Today
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Task count */}
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
        {taskCount} tasks
      </div>
    </div>
  );
};
