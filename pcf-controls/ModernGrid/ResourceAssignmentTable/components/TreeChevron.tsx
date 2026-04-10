import * as React from "react";

export interface ITreeChevronProps {
  isExpanded: boolean;
  hasChildren: boolean;
  depth: number;
  onToggle: () => void;
}

/**
 * Renders a tree indent + expand/collapse chevron for hierarchical rows.
 * - Indents by depth * 20px
 * - Shows ▶/▼ for parent rows (clickable)
 * - Shows a subtle dot for leaf rows
 */
export const TreeChevron: React.FC<ITreeChevronProps> = ({
  isExpanded,
  hasChildren,
  depth,
  onToggle,
}) => {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        paddingLeft: depth * 20,
        marginRight: 4,
        flexShrink: 0,
      }}
    >
      {hasChildren ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0 4px",
            fontSize: 10,
            color: "#64748b",
            lineHeight: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 18,
            height: 18,
            borderRadius: 4,
            transition: "background 0.1s",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.background = "#e2e8f0")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.background = "none")
          }
          title={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? "\u25BC" : "\u25B6"}
        </button>
      ) : (
        <span
          style={{
            width: 18,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#cbd5e1",
            fontSize: 8,
          }}
        >
          {"\u25CF"}
        </span>
      )}
    </span>
  );
};
