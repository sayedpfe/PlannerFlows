/**
 * Type definitions for frappe-gantt@0.6.1
 */

declare module "frappe-gantt/dist/frappe-gantt" {
  export interface Task {
    id: string;
    name: string;
    start: string;
    end: string;
    progress: number;
    dependencies?: string;
    custom_class?: string;
    [key: string]: string | number | undefined;
  }

  export interface GanttOptions {
    header_height?: number;
    column_width?: number;
    step?: number;
    view_modes?: string[];
    bar_height?: number;
    bar_corner_radius?: number;
    arrow_curve?: number;
    padding?: number;
    view_mode?: string;
    date_format?: string;
    language?: string;
    custom_popup_html?: ((task: Task) => string) | null;
    on_click?: (task: Task) => void;
    on_date_change?: (task: Task, start: Date, end: Date) => void;
    on_progress_change?: (task: Task, progress: number) => void;
    on_view_change?: (mode: string) => void;
  }

  export default class Gantt {
    constructor(
      wrapper: string | SVGElement | HTMLElement,
      tasks: Task[],
      options?: GanttOptions
    );
    change_view_mode(mode: string): void;
    refresh(tasks: Task[]): void;
  }
}
