import { useState, useCallback, useMemo } from "react";

const STORAGE_PREFIX = "pcf_tree_state_";

/**
 * Hook to manage tree expand/collapse state.
 * Persists collapsed IDs to localStorage.
 * Default: all nodes expanded (collapsed set is empty).
 */
export function useTreeState(storageKey: string) {
  // Load collapsed IDs from localStorage on init
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return new Set<string>(parsed);
      }
    } catch {
      // Ignore storage errors
    }
    return new Set<string>();
  });

  const persist = useCallback(
    (newSet: Set<string>) => {
      try {
        localStorage.setItem(
          STORAGE_PREFIX + storageKey,
          JSON.stringify(Array.from(newSet))
        );
      } catch {
        // Ignore storage errors
      }
    },
    [storageKey]
  );

  const toggleExpand = useCallback(
    (rowId: string) => {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(rowId)) {
          next.delete(rowId);
        } else {
          next.add(rowId);
        }
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const expandAll = useCallback(() => {
    const next = new Set<string>();
    persist(next);
    setCollapsedIds(next);
  }, [persist]);

  const collapseAll = useCallback(
    (allParentIds: string[]) => {
      const next = new Set<string>(allParentIds);
      persist(next);
      setCollapsedIds(next);
    },
    [persist]
  );

  // Collapsed IDs — a node is expanded if NOT in this set
  // We expose collapsedIds directly instead of a fake inverted Set
  const isExpanded = useCallback(
    (rowId: string) => !collapsedIds.has(rowId),
    [collapsedIds]
  );

  return {
    collapsedIds,
    toggleExpand,
    expandAll,
    collapseAll,
    isExpanded,
  };
}
