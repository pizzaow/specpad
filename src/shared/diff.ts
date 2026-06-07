// Pure, id-keyed semantic diff of SpecPad documents. No git, no I/O, no clock.
// See specpad-change-tracking-design.md §5. Assumes item ids are unique
// (uniqueness is the validate layer's concern, not this module's).
import type { SrsDoc, VtpDoc, SrsItem, VtpItem } from './schema';

export type ChangeStatus = 'added' | 'removed' | 'modified';

export interface ItemChange<T> {
  id: string;
  status: ChangeStatus;
  before?: T; // absent for 'added'
  after?: T; // absent for 'removed'
  changedFields?: string[]; // populated for 'modified'
}

export interface DocDiff<T> {
  added: ItemChange<T>[];
  removed: ItemChange<T>[];
  modified: ItemChange<T>[];
}

// Whole-field equality. Arrays (verifies/tags/hazards) compare order-insensitively;
// scalars compare with ===.
function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const sa = [...a].map((x) => JSON.stringify(x)).sort();
    const sb = [...b].map((x) => JSON.stringify(x)).sort();
    return sa.every((v, i) => v === sb[i]);
  }
  return a === b;
}

function changedFields<T extends { id: string }>(before: T, after: T): string[] {
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  keys.delete('id');
  const changed: string[] = [];
  for (const key of keys) {
    const bv = (before as Record<string, unknown>)[key];
    const av = (after as Record<string, unknown>)[key];
    if (!valuesEqual(bv, av)) changed.push(key);
  }
  return changed.sort();
}

export function diffItems<T extends { id: string }>(oldItems: T[], newItems: T[]): DocDiff<T> {
  const oldById = new Map(oldItems.map((i) => [i.id, i]));
  const newById = new Map(newItems.map((i) => [i.id, i]));
  const added: ItemChange<T>[] = [];
  const removed: ItemChange<T>[] = [];
  const modified: ItemChange<T>[] = [];

  for (const item of newItems) {
    if (!oldById.has(item.id)) added.push({ id: item.id, status: 'added', after: item });
  }
  for (const item of oldItems) {
    if (!newById.has(item.id)) removed.push({ id: item.id, status: 'removed', before: item });
  }
  for (const item of newItems) {
    const before = oldById.get(item.id);
    if (!before) continue;
    const fields = changedFields(before, item);
    if (fields.length > 0) {
      modified.push({ id: item.id, status: 'modified', before, after: item, changedFields: fields });
    }
  }
  return { added, removed, modified };
}

export function diffDocs(
  oldDoc: SrsDoc | VtpDoc,
  newDoc: SrsDoc | VtpDoc,
): DocDiff<SrsItem | VtpItem> {
  if (oldDoc.type !== newDoc.type) {
    throw new Error(
      `Cannot diff documents of different types: ${oldDoc.type} vs ${newDoc.type}`,
    );
  }
  return diffItems<SrsItem | VtpItem>(oldDoc.items, newDoc.items);
}
