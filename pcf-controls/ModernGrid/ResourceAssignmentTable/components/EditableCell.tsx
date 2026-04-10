import * as React from "react";
import { CellType } from "../utils/types";

interface IEditableCellProps {
  value: string;
  rawValue: any;
  cellType: CellType;
  options?: string[];
  onChange: (newValue: string) => void;
  children: React.ReactNode;
}

/**
 * Inline-editable cell wrapper.
 * Shows display content by default; on click switches to an appropriate input.
 * Enter/blur saves, Escape cancels.
 */
export const EditableCell: React.FC<IEditableCellProps> = ({
  value,
  rawValue,
  cellType,
  options,
  onChange,
  children,
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement | HTMLSelectElement>(null);

  // Sync draft when value changes externally
  React.useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  // Auto-focus input when entering edit mode
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement && cellType !== "date") {
        inputRef.current.select();
      }
    }
  }, [isEditing, cellType]);

  const save = React.useCallback(() => {
    setIsEditing(false);
    if (draft !== value) {
      onChange(draft);
    }
  }, [draft, value, onChange]);

  const cancel = React.useCallback(() => {
    setIsEditing(false);
    setDraft(value);
  }, [value]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        save();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    },
    [save, cancel]
  );

  // Boolean: toggle on click, no edit mode needed
  if (cellType === "boolean") {
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          const newVal = rawValue ? "false" : "true";
          onChange(newVal);
        }}
        style={{ cursor: "pointer" }}
        title="Click to toggle"
      >
        {children}
      </div>
    );
  }

  // Resources: handled by MultiSelectDropdown, not EditableCell
  if (cellType === "resources") {
    return <>{children}</>;
  }

  if (!isEditing) {
    return (
      <div
        onClick={() => setIsEditing(true)}
        style={{
          cursor: "pointer",
          position: "relative",
          borderRadius: 4,
          transition: "background 0.1s, box-shadow 0.1s",
          padding: "1px 2px",
          margin: "-1px -2px",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "#f0f4ff";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 1.5px #bfdbfe";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
        title="Click to edit"
      >
        {children}
      </div>
    );
  }

  // Edit mode: render appropriate input
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "5px 8px",
    border: "2px solid #3b82f6",
    borderRadius: 6,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box" as const,
    background: "#fff",
    boxShadow: "0 0 0 3px rgba(59,130,246,0.12)",
    fontFamily: "inherit",
  };

  switch (cellType) {
    case "optionset":
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            // Auto-save on selection
            onChange(e.target.value);
            setIsEditing(false);
          }}
          onBlur={cancel}
          onKeyDown={handleKeyDown}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="">-- Select --</option>
          {(options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case "date":
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="date"
          value={formatDateForInput(rawValue)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          style={inputStyle}
        />
      );

    case "number":
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          style={{ ...inputStyle, textAlign: "right" }}
        />
      );

    case "text":
    default:
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          style={inputStyle}
        />
      );
  }
};

/**
 * Convert a raw date value to YYYY-MM-DD format for the HTML date input.
 */
function formatDateForInput(rawValue: any): string {
  if (!rawValue) return "";
  try {
    const d = new Date(rawValue);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  } catch {
    return "";
  }
}
