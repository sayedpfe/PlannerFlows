import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import { ModernTable as ModernTableComponent, IModernTableProps } from "./components/ResourceTable";
import { ErrorBoundary } from "./components/ErrorBoundary";
import {
  IRow,
  IResource,
  IColumnDef,
  IPersonSearchResult,
  RESOURCE_COLORS,
  mapDataTypeToCellType,
  getDefaultWidth,
  getMinWidth,
} from "./utils/types";

export class ProjectGrid implements ComponentFramework.ReactControl<IInputs, IOutputs> {
  private notifyOutputChanged!: () => void;
  private lastChangePayload: string = "";
  private lastPeopleSearchQuery: string = "";
  private lastSelectedItems: string = "[]";
  private lastTaskCreatePayload: string = "";
  private context!: ComponentFramework.Context<IInputs>;
  private resourceChangeTimer: ReturnType<typeof setTimeout> | null = null;
  /** Persistent cache: resource ID → display name (survives re-renders) */
  private nameCache: Map<string, string> = new Map();
  /** Stable bound references — created once so React doesn't see new functions each render */
  private boundHandleResourceChange = this.handleResourceChange.bind(this);
  private boundHandleCellChange = this.handleCellChange.bind(this);
  private boundHandlePeopleSearch = this.handlePeopleSearch.bind(this);
  private boundHandleSelectionChange = this.handleSelectionChange.bind(this);
  private boundHandleTaskCreate = this.handleTaskCreate.bind(this);

  constructor() {}

  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary
  ): void {
    this.notifyOutputChanged = notifyOutputChanged;
    this.context = context;
    context.mode.trackContainerResize(true);
  }

  public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
    this.context = context;

    try {
      const dataset = context.parameters.dataSet;
      const resourceColumnName = context.parameters.resourceColumnName?.raw || "";
      const percentColumnName = (context.parameters as any).percentColumnName?.raw || "";
      const outlineLevelColumn = (context.parameters as any).outlineLevelColumn?.raw || "";
      const parentIdColumn = (context.parameters as any).parentIdColumn?.raw || "";
      const sortOrderColumn = (context.parameters as any).sortOrderColumn?.raw || "";
      const enableSelection = (context.parameters as any).enableSelection?.raw ?? false;
      const enableInlineCreate = (context.parameters as any).enableInlineCreate?.raw ?? false;

      const columns = this.buildColumnDefs(dataset, resourceColumnName, percentColumnName);
      const rows = this.mapDatasetToRows(dataset, columns, resourceColumnName);

      // Extract people from the dataset's People column
      let resources = resourceColumnName
        ? this.extractResourcesFromDataset(dataset, resourceColumnName)
        : [];

      // Merge AD search results into resources list
      const adResults = this.parseADSearchResults(context);
      if (adResults.length > 0) {
        resources = this.mergeADResults(resources, adResults);
      }

      // Parse comma-separated editable column names into a Set
      const editableColumnsRaw = (context.parameters as any).editableColumns?.raw || "";
      const editableColumnKeys = new Set<string>(
        editableColumnsRaw
          .split(",")
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0)
      );

      const props: IModernTableProps = {
        rows,
        columns,
        resources,
        resourceColumnKey: resourceColumnName
          ? this.findResourceColumnKey(columns)
          : undefined,
        enableResize: context.parameters.enableResize?.raw ?? true,
        enableSort: context.parameters.enableSort?.raw ?? true,
        enableFilter: context.parameters.enableFilter?.raw ?? true,
        enableSearch: context.parameters.enableSearch?.raw ?? true,
        editableColumnKeys,
        tableHeight: context.parameters.tableHeight?.raw ?? 0,
        outlineLevelKey: outlineLevelColumn || undefined,
        parentIdKey: parentIdColumn || undefined,
        sortOrderKey: sortOrderColumn || undefined,
        enableSelection,
        onSelectionChange: enableSelection ? this.boundHandleSelectionChange : undefined,
        enableInlineCreate,
        onTaskCreate: enableInlineCreate ? this.boundHandleTaskCreate : undefined,
        onResourceChange: resourceColumnName
          ? this.boundHandleResourceChange
          : undefined,
        onCellChange: editableColumnKeys.size > 0
          ? this.boundHandleCellChange
          : undefined,
        onPeopleSearchChange: resourceColumnName
          ? this.boundHandlePeopleSearch
          : undefined,
        isSearchingAD: this.lastPeopleSearchQuery.length >= 2 && adResults.length === 0,
      };

      return React.createElement(ErrorBoundary, null,
        React.createElement(ModernTableComponent, props)
      );
    } catch (error) {
      console.error("[ModernTable] Error in updateView:", error);
      // Return a safe error display instead of crashing
      return React.createElement("div", {
        style: {
          padding: "20px",
          color: "#dc2626",
          background: "#fef2f2",
          border: "1px solid #fca5a5",
          borderRadius: "8px",
          fontFamily: "'Segoe UI', sans-serif",
          fontSize: "13px",
        },
      },
        React.createElement("div", { style: { fontWeight: 600, marginBottom: "8px" } }, "Modern Table - Configuration Error"),
        React.createElement("div", null, `${error instanceof Error ? error.message : String(error)}`),
        React.createElement("div", { style: { marginTop: "8px", color: "#92400e", fontSize: "12px" } },
          "Check that your People Column Name matches the internal column name in your data source."
        )
      );
    }
  }

  /**
   * Build column definitions dynamically from the dataset's columns metadata.
   */
  private buildColumnDefs(
    dataset: ComponentFramework.PropertyTypes.DataSet,
    resourceColumnName: string,
    percentColumnName?: string
  ): IColumnDef[] {
    if (!dataset || !dataset.columns || dataset.columns.length === 0) {
      return [];
    }

    return [...dataset.columns]
      .sort((a: any, b: any) => ((a.order ?? 0) as number) - ((b.order ?? 0) as number))
      .map((col: any) => {
        const isResourceCol =
          resourceColumnName !== "" &&
          (col.name === resourceColumnName || col.alias === resourceColumnName);

        const isPercentCol =
          !!percentColumnName &&
          (col.name === percentColumnName || col.alias === percentColumnName);

        const cellType = mapDataTypeToCellType(col.dataType, isResourceCol, isPercentCol);

        const filterable =
          cellType === "optionset" ||
          cellType === "boolean" ||
          cellType === "resources";

        return {
          key: col.alias || col.name,
          label: col.displayName || col.name,
          dataType: col.dataType,
          defaultWidth: getDefaultWidth(cellType),
          minWidth: getMinWidth(cellType),
          sortable: true,
          filterable,
          resizable: true,
          cellType,
        } as IColumnDef;
      });
  }

  /**
   * Find the column key that corresponds to the resource column.
   */
  private findResourceColumnKey(columns: IColumnDef[]): string | undefined {
    const col = columns.find((c) => c.cellType === "resources");
    return col?.key;
  }

  /**
   * Map dataset rows to generic IRow objects.
   */
  private mapDatasetToRows(
    dataset: ComponentFramework.PropertyTypes.DataSet,
    columns: IColumnDef[],
    resourceColumnName: string
  ): IRow[] {
    if (!dataset || !dataset.sortedRecordIds || dataset.sortedRecordIds.length === 0) {
      return [];
    }

    const resourceColKey = this.findResourceColumnKey(columns);

    return dataset.sortedRecordIds.map((recordId: string) => {
      const record = dataset.records[recordId];
      if (!record) {
        return { id: recordId, values: {}, formattedValues: {}, resourceIds: [] };
      }

      const values: Record<string, any> = {};
      const formattedValues: Record<string, string> = {};

      for (const col of columns) {
        try {
          const raw = record.getValue(col.key);
          const formatted = record.getFormattedValue(col.key);
          values[col.key] = raw;
          // For objects (like EntityReference), use formatted value or stringify
          if (raw != null && typeof raw === "object") {
            formattedValues[col.key] = formatted || (raw as any).name || "";
          } else {
            formattedValues[col.key] = formatted || (raw != null ? String(raw) : "");
          }
        } catch {
          values[col.key] = null;
          formattedValues[col.key] = "";
        }
      }

      let resourceIds: string[] = [];
      if (resourceColKey) {
        try {
          const rawValue = record.getValue(resourceColKey);
          resourceIds = this.parseResourceIds(rawValue);
        } catch {
          resourceIds = [];
        }
      }

      return {
        id: recordId,
        values,
        formattedValues,
        resourceIds,
        _raw: record,
      };
    });
  }

  /**
   * Parse resource IDs from a column value.
   * Handles: EntityReference objects (SharePoint People columns), JSON arrays,
   * comma-separated, semicolon-separated, single value.
   */
  private parseResourceIds(value: any): string[] {
    if (value == null) return [];

    // Handle EntityReference array (SharePoint People/Group multi-value columns)
    if (Array.isArray(value)) {
      return value
        .map((item: any) => {
          if (typeof item === "object" && item !== null) {
            return (item.id?.guid ?? item.id)?.toString() || item.name || item.etn || "";
          }
          return String(item);
        })
        .filter(Boolean);
    }

    // Handle single EntityReference object (SharePoint People/Group column)
    if (typeof value === "object" && value !== null) {
      const id = (value.id?.guid ?? value.id)?.toString() || value.name || "";
      return id ? [id] : [];
    }

    // Handle string values
    const strValue = String(value);
    if (!strValue.trim()) return [];

    try {
      const parsed = JSON.parse(strValue);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // Not JSON
    }

    if (strValue.includes(",")) {
      return strValue.split(",").map((s) => s.trim()).filter(Boolean);
    }

    if (strValue.includes(";")) {
      return strValue.split(";").map((s) => s.trim()).filter(Boolean);
    }

    return strValue.trim() ? [strValue.trim()] : [];
  }

  /**
   * Extract unique resource identifiers from the dataset's People column.
   * Handles SharePoint People/Group columns which return EntityReference objects.
   */
  private extractResourcesFromDataset(
    dataset: ComponentFramework.PropertyTypes.DataSet,
    resourceColumnName: string
  ): IResource[] {
    const resourceMap = new Map<string, IResource>();
    let colorIdx = 0;

    // Find the actual column key (could be alias or name)
    let resourceColKey: string | undefined;
    for (const col of dataset.columns) {
      if (col.name === resourceColumnName || col.alias === resourceColumnName) {
        resourceColKey = col.alias || col.name;
        break;
      }
    }
    if (!resourceColKey) return [];

    try {
      dataset.sortedRecordIds.forEach((recordId: string) => {
        const record = dataset.records[recordId];
        if (!record) return;

        const rawValue = record.getValue(resourceColKey!);
        const formattedValue = record.getFormattedValue(resourceColKey!) || "";

        // Try to extract resource info from raw value (EntityReference objects)
        const extractedResources = this.extractResourceInfo(rawValue, formattedValue);

        extractedResources.forEach((res) => {
          if (!resourceMap.has(res.id)) {
            // Use cached name if available and current name is a GUID
            const cachedName = this.nameCache.get(res.id);
            const displayName = (this.isNotDisplayName(res.name) && cachedName)
              ? cachedName : res.name;

            resourceMap.set(res.id, {
              id: res.id,
              name: displayName,
              role: "",
              color: RESOURCE_COLORS[colorIdx % RESOURCE_COLORS.length],
            });
            colorIdx++;
          }
        });
      });
    } catch (e) {
      console.warn("[ModernTable] Error extracting resources:", e);
    }

    return Array.from(resourceMap.values());
  }

  /**
   * Check if a string contains only GUIDs/JSON — not a real display name.
   */
  private isNotDisplayName(str: string): boolean {
    if (!str) return true;
    // Strip JSON brackets, quotes, whitespace
    const cleaned = str.replace(/[\[\]"'\s]/g, "");
    if (!cleaned) return true;
    // Check if every comma-separated part is a GUID
    const parts = cleaned.split(",").filter(Boolean);
    return parts.every((p) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.trim())
    );
  }

  /**
   * Clean up a display name: strip JSON brackets, and if result is just GUIDs,
   * return a friendly short form like "User (1a5b...c239)".
   */
  private cleanDisplayName(name: string, id: string): string {
    if (!name) return this.shortGuid(id);
    // Strip JSON array brackets and quotes
    let cleaned = name.trim();
    if (cleaned.startsWith("[")) {
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          cleaned = parsed.map(String).join(", ");
        }
      } catch {
        cleaned = cleaned.replace(/[\[\]"]/g, "").trim();
      }
    }
    // If still a GUID, show friendly short form
    if (this.isNotDisplayName(cleaned)) {
      return this.shortGuid(id);
    }
    return cleaned;
  }

  /**
   * Create a short friendly label from a GUID: "User (1a5b...c239)"
   */
  private shortGuid(id: string): string {
    const clean = id.replace(/[\[\]"]/g, "").trim();
    if (clean.length > 12) {
      return `User (${clean.slice(0, 4)}...${clean.slice(-4)})`;
    }
    return clean || "Unknown";
  }

  /**
   * Extract resource info from a raw column value.
   * Handles EntityReference objects, arrays, and plain strings.
   * Uses formattedValue as fallback for display names when raw names are GUIDs or empty.
   */
  private extractResourceInfo(
    rawValue: any,
    formattedValue: string
  ): Array<{ id: string; name: string }> {
    if (rawValue == null) return [];

    // Parse formatted value — but only use entries that are real names (not GUIDs)
    const formattedNames = formattedValue
      ? formattedValue.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
      : [];
    const cleanFormattedNames = formattedNames.filter((n) => !this.isNotDisplayName(n));

    // Helper: resolve name using cache, formatted value, or fallback
    const resolveName = (id: string, rawName: string, idx: number): string => {
      // 1. If raw name is a real display name, cache it and return
      if (rawName && !this.isNotDisplayName(rawName)) {
        this.nameCache.set(id, rawName);
        return rawName;
      }
      // 2. Try formatted name by position
      const formatted = cleanFormattedNames[idx] || "";
      if (formatted) {
        this.nameCache.set(id, formatted);
        return formatted;
      }
      // 3. Check persistent cache (may have been resolved via AD search)
      const cached = this.nameCache.get(id);
      if (cached) return cached;
      // 4. Last resort: short GUID
      return this.cleanDisplayName(rawName, id);
    };

    // Handle EntityReference array (multi-value People column)
    if (Array.isArray(rawValue)) {
      return rawValue
        .map((item: any, idx: number) => {
          let id = "";
          let name = "";

          if (typeof item === "object" && item !== null) {
            id = (item.id?.guid ?? item.id)?.toString() || item.name || "";
            name = item.name || item.displayName || item.DisplayName || "";
          } else {
            id = String(item);
            name = String(item);
          }

          name = resolveName(id, name, idx);
          return { id, name };
        })
        .filter((r) => r.id !== "");
    }

    // Handle single EntityReference object
    if (typeof rawValue === "object" && rawValue !== null) {
      const id = (rawValue.id?.guid ?? rawValue.id)?.toString() || rawValue.name || "";
      const rawName = rawValue.name || rawValue.displayName || rawValue.DisplayName || "";
      const name = resolveName(id, rawName, 0);
      return id ? [{ id, name }] : [];
    }

    // Handle string values
    const strValue = String(rawValue);
    if (!strValue.trim()) return [];

    const ids = this.parseResourceIds(strValue);
    return ids.map((id, idx) => {
      const name = resolveName(id, "", idx);
      return { id, name };
    });
  }

  /**
   * Called when a user assigns or unassigns resources from a row.
   */
  private handleResourceChange(rowId: string, resourceIds: string[]): void {
    try {
      const dataset = this.context.parameters.dataSet;
      const record = dataset.records[rowId];

      if (!record) {
        console.warn(`[ModernTable] Record not found: ${rowId}`);
        return;
      }

      const newValue = JSON.stringify(resourceIds);

      // Find the resource column key
      const resourceColumnName = this.context.parameters.resourceColumnName?.raw || "";
      let resourceColKey: string | undefined;
      for (const col of dataset.columns) {
        if (col.name === resourceColumnName || col.alias === resourceColumnName) {
          resourceColKey = col.alias || col.name;
          break;
        }
      }

      if (resourceColKey) {
        // @ts-ignore - PCF internal API for updating bound fields
        if (record.setValue) {
          // @ts-ignore
          record.setValue(resourceColKey, newValue);
        }
      }

      this.lastChangePayload = JSON.stringify({
        rowId,
        column: resourceColKey || resourceColumnName,
        resourceIds: newValue,
        timestamp: new Date().toISOString(),
      });

      // Debounce notifyOutputChanged to prevent rapid Power Apps re-renders
      if (this.resourceChangeTimer) clearTimeout(this.resourceChangeTimer);
      this.resourceChangeTimer = setTimeout(() => {
        this.notifyOutputChanged();
      }, 300);
    } catch (e) {
      console.error("[ModernTable] Error in handleResourceChange:", e);
    }
  }

  /**
   * Called when a user edits a non-resource cell value.
   */
  private handleCellChange(rowId: string, columnKey: string, newValue: string): void {
    try {
      const dataset = this.context.parameters.dataSet;
      const record = dataset.records[rowId];

      if (!record) {
        console.warn(`[ModernTable] Record not found: ${rowId}`);
        return;
      }

      const oldValue = record.getFormattedValue(columnKey) || "";

      // @ts-ignore - PCF internal API for updating bound fields
      if (record.setValue) {
        // @ts-ignore
        record.setValue(columnKey, newValue);
      }

      this.lastChangePayload = JSON.stringify({
        rowId,
        column: columnKey,
        value: newValue,
        oldValue,
        timestamp: new Date().toISOString(),
      });

      this.notifyOutputChanged();
    } catch (e) {
      console.error("[ModernTable] Error in handleCellChange:", e);
    }
  }

  /**
   * Called when user types in the people picker search box.
   * Emits the query via peopleSearchQuery output for Power Apps to handle.
   */
  private handlePeopleSearch(query: string): void {
    this.lastPeopleSearchQuery = query;
    this.notifyOutputChanged();
  }

  /**
   * Parse AD search results from the peopleSearchResults input property.
   */
  private parseADSearchResults(
    context: ComponentFramework.Context<IInputs>
  ): IPersonSearchResult[] {
    try {
      const raw = (context.parameters as any).peopleSearchResults?.raw;
      if (!raw || typeof raw !== "string" || !raw.trim()) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item: any) => ({
          id: item.id?.toString() || item.Id?.toString() || item.mail || item.Mail || "",
          name: item.name || item.DisplayName || item.displayName || item.Name || "",
          email: item.email || item.Mail || item.mail || item.UserPrincipalName || "",
          role: item.role || item.JobTitle || item.jobTitle || item.Department || "",
        }))
        .filter((r: IPersonSearchResult) => r.id !== "" && r.name !== "");
    } catch {
      return [];
    }
  }

  /**
   * Merge AD search results into the existing resources list,
   * avoiding duplicates by ID.
   */
  private mergeADResults(
    existing: IResource[],
    adResults: IPersonSearchResult[]
  ): IResource[] {
    const existingIds = new Set(existing.map((r) => r.id));
    const merged = [...existing];
    let colorIdx = existing.length;

    for (const ad of adResults) {
      // Always cache AD-resolved names (they are authoritative)
      if (ad.name) {
        this.nameCache.set(ad.id, ad.name);
      }

      if (!existingIds.has(ad.id)) {
        merged.push({
          id: ad.id,
          name: ad.name,
          email: ad.email,
          role: ad.role || "",
          color: RESOURCE_COLORS[colorIdx % RESOURCE_COLORS.length],
        });
        colorIdx++;
        existingIds.add(ad.id);
      } else {
        // Update existing resource name from AD if it was showing a GUID
        const existing = merged.find((r) => r.id === ad.id);
        if (existing && this.isNotDisplayName(existing.name)) {
          existing.name = ad.name;
          if (ad.email) existing.email = ad.email;
          if (ad.role) existing.role = ad.role;
        }
      }
    }

    return merged;
  }

  public getOutputs(): IOutputs {
    return {
      onCellChange: this.lastChangePayload,
      peopleSearchQuery: this.lastPeopleSearchQuery,
      selectedItems: this.lastSelectedItems,
      onTaskCreate: this.lastTaskCreatePayload,
    } as IOutputs;
  }

  private handleSelectionChange(selectedIds: string[]): void {
    this.lastSelectedItems = JSON.stringify(selectedIds);
    this.notifyOutputChanged();
  }

  private handleTaskCreate(payload: { parentId: string | null; title: string; outlineLevel: number }): void {
    this.lastTaskCreatePayload = JSON.stringify({
      ...payload,
      timestamp: new Date().toISOString(),
    });
    this.notifyOutputChanged();
  }

  public destroy(): void {
    if (this.resourceChangeTimer) clearTimeout(this.resourceChangeTimer);
  }
}
