import * as React from "react";
import { IColumnDef } from "../utils/types";
import { saveColumnWidths, loadColumnWidths } from "../utils/helpers";

interface UseColumnResizeReturn {
  widths: Record<string, number>;
  startResize: (columnKey: string, startX: number) => void;
  isResizing: boolean;
}

/**
 * Hook to manage column resize state and drag behavior.
 * Persists widths to localStorage so they survive page refresh.
 */
export function useColumnResize(columns: IColumnDef[]): UseColumnResizeReturn {
  const [widths, setWidths] = React.useState<Record<string, number>>(() => {
    // Try to load persisted widths
    const saved = loadColumnWidths();
    if (saved) return saved;
    // Fall back to defaults
    return columns.reduce((acc, col) => ({ ...acc, [col.key]: col.defaultWidth }), {});
  });

  const [isResizing, setIsResizing] = React.useState(false);
  const resizeRef = React.useRef<{
    column: string;
    startX: number;
    startWidth: number;
    minWidth: number;
  } | null>(null);

  const startResize = React.useCallback(
    (columnKey: string, startX: number) => {
      const col = columns.find((c) => c.key === columnKey);
      if (!col || !col.resizable) return;

      resizeRef.current = {
        column: columnKey,
        startX,
        startWidth: widths[columnKey] || col.defaultWidth,
        minWidth: col.minWidth,
      };
      setIsResizing(true);
    },
    [columns, widths]
  );

  React.useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const { column, startX, startWidth, minWidth } = resizeRef.current;
      const delta = e.clientX - startX;
      const newWidth = Math.max(minWidth, startWidth + delta);
      setWidths((prev) => ({ ...prev, [column]: newWidth }));
    };

    const onMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
      // Persist after resize ends
      setWidths((current) => {
        saveColumnWidths(current);
        return current;
      });
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isResizing]);

  return { widths, startResize, isResizing };
}
