import { IRow, ITreeNode } from "./types";

/**
 * Build tree-ordered list of nodes from flat rows using OutlineLevel and ParentTaskId.
 *
 * Algorithm:
 *   1. Group rows by parentId
 *   2. Sort each group by sortOrder
 *   3. DFS traversal: emit parent, then children recursively
 *   4. Mark hasChildren = childMap.has(row.id)
 */
export function buildTreeOrder(
  rows: IRow[],
  outlineLevelKey: string,
  parentIdKey: string,
  sortOrderKey: string
): ITreeNode[] {
  // Build child map: parentId → children rows
  const childMap = new Map<string, IRow[]>();
  const rootRows: IRow[] = [];

  for (const row of rows) {
    const parentId = row.values[parentIdKey];
    const parentIdStr = parentId != null && parentId !== "" && parentId !== 0
      ? String(parentId)
      : null;

    if (parentIdStr === null) {
      rootRows.push(row);
    } else {
      const children = childMap.get(parentIdStr) || [];
      children.push(row);
      childMap.set(parentIdStr, children);
    }
  }

  // Sort helper
  const sortByOrder = (a: IRow, b: IRow): number => {
    const aOrder = Number(a.values[sortOrderKey]) || 0;
    const bOrder = Number(b.values[sortOrderKey]) || 0;
    return aOrder - bOrder;
  };

  rootRows.sort(sortByOrder);
  for (const children of childMap.values()) {
    children.sort(sortByOrder);
  }

  // DFS traversal
  const result: ITreeNode[] = [];

  const visit = (row: IRow, depth: number, parentId: string | null) => {
    const rowId = row.id;
    const children = childMap.get(rowId);
    const hasChildren = children != null && children.length > 0;

    result.push({ row, depth, hasChildren, parentId });

    if (hasChildren) {
      for (const child of children!) {
        visit(child, depth + 1, rowId);
      }
    }
  };

  for (const root of rootRows) {
    visit(root, 0, null);
  }

  // Any orphaned rows (parentId doesn't match any existing row) — append at root level
  const visitedIds = new Set(result.map((n) => n.row.id));
  for (const row of rows) {
    if (!visitedIds.has(row.id)) {
      result.push({ row, depth: 0, hasChildren: false, parentId: null });
    }
  }

  return result;
}

/**
 * Filter tree nodes to only show visible rows based on collapsed state.
 * Children of collapsed parents are hidden.
 * @param collapsedIds - Set of row IDs that are collapsed (children hidden)
 */
export function filterVisibleRows(
  treeNodes: ITreeNode[],
  collapsedIds: Set<string>
): ITreeNode[] {
  const result: ITreeNode[] = [];
  let collapsedAtDepth: number | null = null;

  for (const node of treeNodes) {
    if (collapsedAtDepth !== null) {
      if (node.depth > collapsedAtDepth) {
        continue;
      }
      collapsedAtDepth = null;
    }

    result.push(node);

    // If this node has children and IS in collapsedIds, begin skipping
    if (node.hasChildren && collapsedIds.has(node.row.id)) {
      collapsedAtDepth = node.depth;
    }
  }

  return result;
}
