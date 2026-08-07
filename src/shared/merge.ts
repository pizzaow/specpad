// Pure three-way merge of SpecPad documents, keyed on stable item ids.
// No git, no I/O, no clock — the same shape of primitive as diff.ts, and the reason
// SpecPad JSON is never merged textually (see docs/design/specpad-server-design.md §6.3).
//
// Two people editing different requirements in one document never conflict, because
// every item carries an immutable `id` and nothing derived is stored: aligning the two
// sides is exact rather than heuristic. A conflict is only ever raised where both sides
// set the *same field of the same item* to different values, or where one side deleted
// an item the other changed.
import type { SrsDoc, VtpDoc, PrdDoc, SrsItem, VtpItem, PrdItem } from './schema';
import { valuesEqual } from './diff';

export type ConflictSide = 'ours' | 'theirs';

/** Both sides set the same field to different values. `itemId` is null for envelope fields. */
export interface FieldConflict {
  itemId: string | null;
  kind: 'field';
  field: string;
  base?: unknown;
  ours?: unknown;
  theirs?: unknown;
}

/** One side deleted an item the other modified. Deletion never silently wins. */
export interface DeleteModifyConflict {
  itemId: string;
  kind: 'delete-modify';
  deletedBy: ConflictSide;
  ours: unknown;
  theirs: unknown;
}

export type MergeConflict = FieldConflict | DeleteModifyConflict;

export interface MergeResult<T> {
  items: T[];
  conflicts: MergeConflict[];
  /** True when the merge resolved everything automatically. */
  clean: boolean;
}

export interface DocMergeResult<T> {
  doc: T;
  conflicts: MergeConflict[];
  clean: boolean;
}

type Row = Record<string, unknown> & { id: string };

/** Whole-item equality, using the diff module's field semantics. */
function itemsEqual(a: Row | undefined, b: Row | undefined): boolean {
  if (!a || !b) return a === b;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!valuesEqual(a[key], b[key])) return false;
  }
  return true;
}

/**
 * Resolve one field. Returns the merged value, or a conflict when both sides moved
 * it to different values. An absent value (`undefined`) is a legitimate side — a field
 * removed on one side merges as a removal.
 */
function mergeField(
  itemId: string | null,
  field: string,
  base: unknown,
  ours: unknown,
  theirs: unknown,
): { value: unknown; conflict?: FieldConflict } {
  if (valuesEqual(ours, theirs)) return { value: ours }; // both agree (including both unchanged)
  if (valuesEqual(base, ours)) return { value: theirs }; // only they moved it
  if (valuesEqual(base, theirs)) return { value: ours }; // only we moved it
  // Both moved it, differently. Keep ours so the document stays structurally valid,
  // and report the conflict for a human to settle.
  return { value: ours, conflict: { itemId, kind: 'field', field, base, ours, theirs } };
}

/** Field-wise three-way merge of one item present on both sides. */
function mergeRow(
  base: Row | undefined,
  ours: Row,
  theirs: Row,
): { item: Row; conflicts: FieldConflict[] } {
  const keys = new Set<string>([
    ...Object.keys(base ?? {}),
    ...Object.keys(ours),
    ...Object.keys(theirs),
  ]);
  keys.delete('id');

  const item: Row = { id: ours.id };
  const conflicts: FieldConflict[] = [];
  for (const key of [...keys].sort()) {
    const { value, conflict } = mergeField(ours.id, key, base?.[key], ours[key], theirs[key]);
    if (conflict) conflicts.push(conflict);
    if (value !== undefined) item[key] = value;
  }
  return { item, conflicts };
}

/**
 * Three-way merge of two divergent item lists against their common ancestor.
 *
 * Ordering follows `ours`; items only the other side has are inserted after the
 * neighbour they followed in `theirs`. A difference in order alone is never a conflict.
 */
export function mergeItems<T extends { id: string }>(
  base: T[],
  ours: T[],
  theirs: T[],
): MergeResult<T> {
  const baseById = new Map(base.map((i) => [i.id, i as unknown as Row]));
  const oursById = new Map(ours.map((i) => [i.id, i as unknown as Row]));
  const theirsById = new Map(theirs.map((i) => [i.id, i as unknown as Row]));

  const conflicts: MergeConflict[] = [];
  const merged = new Map<string, Row>();

  const ids = new Set<string>([...oursById.keys(), ...theirsById.keys()]);
  for (const id of ids) {
    const b = baseById.get(id);
    const o = oursById.get(id);
    const t = theirsById.get(id);

    if (o && t) {
      const { item, conflicts: fieldConflicts } = mergeRow(b, o, t);
      merged.set(id, item);
      conflicts.push(...fieldConflicts);
      continue;
    }

    // Present on one side only: either an addition, or a deletion by the other side.
    const present = (o ?? t) as Row;
    const deletedBy: ConflictSide = o ? 'theirs' : 'ours';

    if (!b) {
      merged.set(id, present); // added by whichever side has it
      continue;
    }
    if (itemsEqual(b, present)) continue; // deleted on one side, untouched on the other

    // Deleted on one side, modified on the other. Keep the surviving version and
    // surface the conflict — a deletion must never silently discard an edit.
    merged.set(id, present);
    conflicts.push({
      itemId: id,
      kind: 'delete-modify',
      deletedBy,
      ours: o ?? null,
      theirs: t ?? null,
    });
  }

  return {
    items: orderMerged(merged, ours, theirs) as unknown as T[],
    conflicts,
    clean: conflicts.length === 0,
  };
}

/** Our order is the spine; items only they have slot in after the neighbour they followed. */
function orderMerged(merged: Map<string, Row>, ours: { id: string }[], theirs: { id: string }[]): Row[] {
  const result: Row[] = [];
  const placed = new Set<string>();
  const theirIds = new Set(theirs.map((i) => i.id));

  for (const { id } of ours) {
    const item = merged.get(id);
    if (item && !placed.has(id)) {
      result.push(item);
      placed.add(id);
    }
  }

  theirs.forEach(({ id }, index) => {
    const item = merged.get(id);
    if (!item || placed.has(id)) return;
    // Nearest preceding sibling in their order that we have already placed.
    let at = 0;
    for (let i = index - 1; i >= 0; i--) {
      const anchor = result.findIndex((r) => r.id === theirs[i].id);
      if (anchor !== -1) {
        at = anchor + 1;
        break;
      }
    }
    // Never jump ahead of an item they have not seen: where both sides inserted after
    // the same neighbour, ours keeps its place and theirs follows it.
    while (at < result.length && !theirIds.has(result[at].id)) at++;
    result.splice(at, 0, item);
    placed.add(id);
  });

  return result;
}

type ItemDoc = SrsDoc | VtpDoc | PrdDoc;
type Item = SrsItem | VtpItem | PrdItem;

// Envelope fields merged with the same rule as item fields. `items` is handled by
// mergeItems; `type` is the discriminator and may never change under a merge.
const ENVELOPE_FIELDS = ['schemaVersion', 'name', 'title'] as const;

/**
 * Three-way merge of two divergent SpecPad documents. Envelope conflicts are reported
 * against a null item id; everything else is item-level.
 */
export function mergeDocs<T extends ItemDoc>(base: T, ours: T, theirs: T): DocMergeResult<T> {
  if (base.type !== ours.type || ours.type !== theirs.type) {
    throw new Error(
      `Cannot merge documents of different types: ${base.type} / ${ours.type} / ${theirs.type}`,
    );
  }

  const conflicts: MergeConflict[] = [];
  const envelope: Record<string, unknown> = {};
  for (const field of ENVELOPE_FIELDS) {
    const { value, conflict } = mergeField(null, field, base[field], ours[field], theirs[field]);
    if (conflict) conflicts.push(conflict);
    if (value !== undefined) envelope[field] = value;
  }

  const items = mergeItems<Item>(base.items, ours.items, theirs.items);
  conflicts.push(...items.conflicts);

  return {
    doc: { ...ours, ...envelope, items: items.items } as T,
    conflicts,
    clean: conflicts.length === 0,
  };
}
