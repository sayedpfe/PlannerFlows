import { IRow } from "./types";

export interface ITreeNode {
  row: IRow;
  depth: number;
  hasChildren: boolean;
  parentId: string | null;
}

export function buildTreeOrder(
  rows: IRow[],
  outlineLevelKey: string,
  parentIdKey: string,
  sortOrderKey: string
): ITreeNode[] {
  const childMap = new Map<string, IRow[]>();
  const rootRows: IRow[] = [];

  for (const row of rows) {
    const parentId = row.values[parentIdKey];
    const parentIdStr = parentId != null && parentId !== "" && parentId !== 0
      ? String(parentId) : null;
    if (parentIdStr === null) {
      rootRows.push(row);
    } else {
      const children = childMap.get(parentIdStr) || [];
      children.push(row);
      childMap.set(parentIdStr, children);
    }
  }

  const sortByOrder = (a: IRow, b: IRow): number =>
    (Number(a.values[sortOrderKey]) || 0) - (Number(b.values[sortOrderKey]) || 0);

  rootRows.sort(sortByOrder);
  for (const children of childMap.values()) {
    children.sort(sortByOrder);
  }

  const result: ITreeNode[] = [];

  const visit = (row: IRow, depth: number, parentId: string | null) => {
    const children = childMap.get(row.id);
    const hasChildren = children != null && children.length > 0;
    result.push({ row, depth, hasChildren, parentId });
    if (children) {
      for (const child of children) {
        visit(child, depth + 1, row.id);
      }
    }
  };

  for (const root of rootRows) {
    visit(root, 0, null);
  }

  const visitedIds = new Set(result.map((n) => n.row.id));
  for (const row of rows) {
    if (!visitedIds.has(row.id)) {
      result.push({ row, depth: 0, hasChildren: false, parentId: null });
    }
  }

  return result;
}

export function filterVisibleRows(
  treeNodes: ITreeNode[],
  collapsedIds: Set<string>
): ITreeNode[] {
  const result: ITreeNode[] = [];
  let collapsedAtDepth: number | null = null;

  for (const node of treeNodes) {
    if (collapsedAtDepth !== null) {
      if (node.depth > collapsedAtDepth) continue;
      collapsedAtDepth = null;
    }
    result.push(node);
    if (node.hasChildren && collapsedIds.has(node.row.id)) {
      collapsedAtDepth = node.depth;
    }
  }

  return result;
}
