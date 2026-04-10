import * as React from "react";
import { ISortState, IFilterState } from "../utils/types";

interface UseSortFilterReturn {
  sort: ISortState;
  filters: IFilterState;
  searchText: string;
  setSearchText: (text: string) => void;
  toggleSort: (column: string) => void;
  setFilter: (column: string, values: string[]) => void;
  clearAllFilters: () => void;
  activeFilterCount: number;
}

/**
 * Hook to manage sort, filter, and search state.
 */
export function useSortFilter(): UseSortFilterReturn {
  const [sort, setSort] = React.useState<ISortState>({ column: null, direction: null });
  const [filters, setFilters] = React.useState<IFilterState>({});
  const [searchText, setSearchText] = React.useState("");

  const toggleSort = React.useCallback((column: string) => {
    setSort((prev) => {
      if (prev.column !== column) return { column, direction: "asc" };
      if (prev.direction === "asc") return { column, direction: "desc" };
      return { column: null, direction: null };
    });
  }, []);

  const setFilter = React.useCallback((column: string, values: string[]) => {
    setFilters((prev) => ({ ...prev, [column]: values }));
  }, []);

  const clearAllFilters = React.useCallback(() => {
    setFilters({});
    setSearchText("");
  }, []);

  const activeFilterCount = React.useMemo(
    () => Object.values(filters).filter((v) => v.length > 0).length + (searchText ? 1 : 0),
    [filters, searchText]
  );

  return {
    sort,
    filters,
    searchText,
    setSearchText,
    toggleSort,
    setFilter,
    clearAllFilters,
    activeFilterCount,
  };
}
