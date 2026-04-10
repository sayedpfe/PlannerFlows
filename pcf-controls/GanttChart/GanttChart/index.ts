import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { GanttView } from "./components/GanttView";
import { GanttToolbar } from "./components/GanttToolbar";
import { mapDatasetToGanttTasks } from "./utils/taskMapper";
import { IGanttColumnConfig, IGanttTask } from "./utils/types";

export class GanttChart implements ComponentFramework.StandardControl<IInputs, IOutputs> {
  private container!: HTMLDivElement;
  private notifyOutputChanged!: () => void;
  private lastDateChangePayload = "";
  private lastProgressChangePayload = "";
  private lastTaskClickPayload = "";
  private currentViewMode = "Week";

  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary,
    container: HTMLDivElement
  ): void {
    this.container = container;
    this.notifyOutputChanged = notifyOutputChanged;
    this.currentViewMode = context.parameters.defaultViewMode?.raw ?? "Week";
    context.mode.trackContainerResize(true);
  }

  public updateView(context: ComponentFramework.Context<IInputs>): void {
    const dataset = context.parameters.dataSet;
    const taskTitleColumn = context.parameters.taskTitleColumn?.raw ?? "";
    const startDateColumn = context.parameters.startDateColumn?.raw ?? "";
    const endDateColumn = context.parameters.endDateColumn?.raw ?? "";

    // Don't render if required columns aren't configured
    if (!taskTitleColumn || !startDateColumn || !endDateColumn) {
      ReactDOM.render(
        React.createElement("div", {
          style: {
            padding: "40px",
            textAlign: "center",
            color: "#64748b",
            fontSize: 14,
            background: "#f8fafc",
            border: "2px dashed #cbd5e1",
            borderRadius: 12,
            fontFamily: "'Segoe UI', sans-serif",
          },
        },
          React.createElement("div", { style: { fontSize: 24, marginBottom: 8 } }, "\uD83D\uDCC5"),
          React.createElement("div", { style: { fontWeight: 600, marginBottom: 4 } }, "Gantt Chart"),
          React.createElement("div", null, "Set Task Title, Start Date, and End Date column properties.")
        ),
        this.container
      );
      return;
    }

    const config: IGanttColumnConfig = {
      taskTitleColumn,
      startDateColumn,
      endDateColumn,
      percentCompleteColumn: context.parameters.percentCompleteColumn?.raw ?? undefined,
      predecessorColumn: context.parameters.predecessorColumn?.raw ?? undefined,
      statusColumn: context.parameters.statusColumn?.raw ?? undefined,
      outlineLevelColumn: context.parameters.outlineLevelColumn?.raw ?? undefined,
      parentIdColumn: context.parameters.parentIdColumn?.raw ?? undefined,
      sortOrderColumn: context.parameters.sortOrderColumn?.raw ?? undefined,
      baselineStartColumn: context.parameters.baselineStartColumn?.raw ?? undefined,
      baselineEndColumn: context.parameters.baselineEndColumn?.raw ?? undefined,
    };

    const tasks = mapDatasetToGanttTasks(dataset, config);
    const chartHeight = context.parameters.chartHeight?.raw ?? 500;
    const enableDragResize = context.parameters.enableDragResize?.raw ?? true;

    const element = React.createElement(
      "div",
      {
        className: "gantt-chart-root",
        style: { fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif" },
      },
      // Toolbar
      React.createElement(GanttToolbar, {
        viewMode: this.currentViewMode,
        onViewModeChange: (mode: string) => {
          this.currentViewMode = mode;
          // Re-render to pass new view mode
          this.updateView(context);
        },
        taskCount: tasks.length,
      }),
      // Gantt chart
      React.createElement(GanttView, {
        tasks,
        viewMode: this.currentViewMode,
        chartHeight,
        enableDragResize,
        onDateChange: (id: string, start: string, end: string) => {
          this.lastDateChangePayload = JSON.stringify({
            id,
            start,
            end,
            timestamp: new Date().toISOString(),
          });
          this.notifyOutputChanged();
        },
        onProgressChange: (id: string, progress: number) => {
          this.lastProgressChangePayload = JSON.stringify({
            id,
            progress,
            timestamp: new Date().toISOString(),
          });
          this.notifyOutputChanged();
        },
        onTaskClick: (id: string, title: string) => {
          this.lastTaskClickPayload = JSON.stringify({
            id,
            title,
            timestamp: new Date().toISOString(),
          });
          this.notifyOutputChanged();
        },
      })
    );

    ReactDOM.render(element, this.container);
  }

  public getOutputs(): IOutputs {
    return {
      onDateChange: this.lastDateChangePayload,
      onProgressChange: this.lastProgressChangePayload,
      onTaskClick: this.lastTaskClickPayload,
    };
  }

  public destroy(): void {
    ReactDOM.unmountComponentAtNode(this.container);
  }
}
