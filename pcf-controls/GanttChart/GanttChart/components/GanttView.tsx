import * as React from "react";
import Gantt, { Task } from "frappe-gantt/dist/frappe-gantt";
import { IGanttTask, dateToISOString } from "../utils/types";

export interface IGanttViewProps {
  tasks: IGanttTask[];
  viewMode: string;
  chartHeight: number;
  enableDragResize: boolean;
  onDateChange?: (id: string, start: string, end: string) => void;
  onProgressChange?: (id: string, progress: number) => void;
  onTaskClick?: (id: string, title: string) => void;
}

/**
 * React wrapper for frappe-gantt.
 * Uses useRef for the SVG container and useEffect to manage the Gantt instance lifecycle.
 */
export const GanttView: React.FC<IGanttViewProps> = ({
  tasks,
  viewMode,
  chartHeight,
  enableDragResize,
  onDateChange,
  onProgressChange,
  onTaskClick,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const ganttRef = React.useRef<Gantt | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  // Create/recreate gantt when tasks change
  React.useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous content
    containerRef.current.innerHTML = "";

    if (tasks.length === 0) {
      containerRef.current.innerHTML =
        '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px;">' +
        "No tasks with dates found in the data source</div>";
      ganttRef.current = null;
      return;
    }

    // Create SVG element for frappe-gantt
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "gantt-chart-svg");
    containerRef.current.appendChild(svg);
    svgRef.current = svg;

    // Map IGanttTask to frappe-gantt Task format
    const ganttTasks: Task[] = tasks.map((t) => ({
      id: t.id,
      name: t.name,
      start: t.start,
      end: t.end,
      progress: t.progress,
      dependencies: t.dependencies || "",
      custom_class: t.custom_class || "",
    }));

    try {
      ganttRef.current = new Gantt(svg, ganttTasks, {
        view_mode: viewMode,
        date_format: "YYYY-MM-DD",
        bar_height: 24,
        bar_corner_radius: 4,
        arrow_curve: 5,
        padding: 14,
        on_click: (task: Task) => {
          onTaskClick?.(task.id, task.name);
        },
        on_date_change: enableDragResize
          ? (task: Task, start: Date, end: Date) => {
              onDateChange?.(task.id, dateToISOString(start), dateToISOString(end));
            }
          : undefined,
        on_progress_change: enableDragResize
          ? (task: Task, progress: number) => {
              onProgressChange?.(task.id, Math.round(progress));
            }
          : undefined,
        custom_popup_html: (task: Task) => {
          const ganttTask = tasks.find((t) => t.id === task.id);
          const statusBadge = ganttTask?.custom_class
            ? `<span class="popup-status ${ganttTask.custom_class}">${ganttTask.custom_class.replace("gantt-bar-", "").replace("gantt-bar-summary", "")}</span>`
            : "";
          return `
            <div class="gantt-popup">
              <div class="gantt-popup-title">${task.name}</div>
              <div class="gantt-popup-dates">${task.start} → ${task.end}</div>
              <div class="gantt-popup-progress">Progress: ${task.progress}%</div>
              ${statusBadge}
            </div>
          `;
        },
      });
    } catch (e) {
      console.error("[GanttChart] Error initializing frappe-gantt:", e);
      containerRef.current.innerHTML =
        '<div style="padding:20px;color:#dc2626;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;font-size:13px;">' +
        "Error rendering Gantt chart. Check that tasks have valid dates.</div>";
    }
  }, [tasks, enableDragResize]); // Recreate on task data change

  // Update view mode without full recreate
  React.useEffect(() => {
    if (ganttRef.current && viewMode) {
      try {
        ganttRef.current.change_view_mode(viewMode);
      } catch {
        // Ignore if view mode not supported
      }
    }
  }, [viewMode]);

  return (
    <div
      ref={containerRef}
      className="gantt-chart-container"
      style={{
        width: "100%",
        height: chartHeight > 0 ? chartHeight : undefined,
        overflowX: "auto",
        overflowY: chartHeight > 0 ? "auto" : "visible",
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    />
  );
};
