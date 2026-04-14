import { useState, useCallback } from "react";

/**
 * Safe localStorage access — Canvas Apps sandbox may block localStorage.
 */
function getStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
      window.localStorage.setItem("__pcf_test__", "1");
      window.localStorage.removeItem("__pcf_test__");
      return window.localStorage;
    }
  } catch {
    // Sandboxed
  }
  return null;
}

const STORAGE_PREFIX = "pcf_tree_state_";

/**
 * Hook to manage tree expand/collapse state.
 * Persists collapsed IDs to localStorage when available.
 * Default: all nodes expanded (collapsed set is empty).
 */
export function useTreeState(storageKey: string) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => {
    const storage = getStorage();
    if (storage) {
      try {
        const stored = storage.getItem(STORAGE_PREFIX + storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return new Set<string>(parsed);
        }
      } catch {
        // Ignore
      }
    }
    return new Set<string>();
  });

  const persist = useCallback(
    (newSet: Set<string>) => {
      const storage = getStorage();
      if (storage) {
        try {
          storage.setItem(
            STORAGE_PREFIX + storageKey,
            JSON.stringify(Array.from(newSet))
          );
        } catch {
          // Ignore
        }
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
