import { describe, it, expect } from 'vitest';
import { mergeItems, mergeDocs } from '../merge';
import type { FieldConflict } from '../merge';
import type { SrsItem, SrsDoc } from '../schema';

// A three-way merge keyed on stable item ids (MRG-1..MRG-4). Pure: no git, no I/O.
// `base` is the common ancestor; `ours` and `theirs` are the two divergent sides.

const req = (id: string, text: string, extra: Partial<SrsItem> = {}): SrsItem => ({
  id,
  text,
  ...extra,
});

const doc = (items: SrsItem[]): SrsDoc => ({
  schemaVersion: '1.0',
  type: 'srs',
  name: 'acme',
  title: 'Requirements',
  items,
});

describe('mergeItems — clean merges', () => {
  it('takes a change made on one side only', () => {
    const base = [req('r_1', 'original'), req('r_2', 'untouched')];
    const ours = [req('r_1', 'ours edited'), req('r_2', 'untouched')];
    const theirs = base;

    const result = mergeItems(base, ours, theirs);

    expect(result.conflicts).toEqual([]);
    expect(result.clean).toBe(true);
    expect(result.items).toEqual([req('r_1', 'ours edited'), req('r_2', 'untouched')]);
  });

  it('takes a change made on the other side only', () => {
    const base = [req('r_1', 'original')];
    const result = mergeItems(base, base, [req('r_1', 'theirs edited')]);

    expect(result.conflicts).toEqual([]);
    expect(result.items).toEqual([req('r_1', 'theirs edited')]);
  });

  it('merges changes to different fields of the same item without conflict (MRG-2)', () => {
    const base = [req('r_1', 'the system shall store', { category: ['data-definition'] })];
    const ours = [req('r_1', 'the system shall store', { category: ['data-definition', 'functional'] })];
    const theirs = [req('r_1', 'the system shall persist', { category: ['data-definition'] })];

    const result = mergeItems(base, ours, theirs);

    expect(result.conflicts).toEqual([]);
    expect(result.items).toEqual([
      req('r_1', 'the system shall persist', { category: ['data-definition', 'functional'] }),
    ]);
  });

  it('accepts the same field changed to the same value on both sides', () => {
    const base = [req('r_1', 'original')];
    const both = [req('r_1', 'agreed')];

    const result = mergeItems(base, both, both);

    expect(result.conflicts).toEqual([]);
    expect(result.items).toEqual([req('r_1', 'agreed')]);
  });

  it('keeps items added on either side', () => {
    const base = [req('r_1', 'shared')];
    const ours = [req('r_1', 'shared'), req('r_2', 'ours added')];
    const theirs = [req('r_1', 'shared'), req('r_3', 'theirs added')];

    const result = mergeItems(base, ours, theirs);

    expect(result.conflicts).toEqual([]);
    expect(result.items.map((i) => i.id)).toEqual(['r_1', 'r_2', 'r_3']);
  });

  it('applies a deletion made on one side when the other left the item untouched', () => {
    const base = [req('r_1', 'doomed'), req('r_2', 'survivor')];
    const ours = base;
    const theirs = [req('r_2', 'survivor')];

    const result = mergeItems(base, ours, theirs);

    expect(result.conflicts).toEqual([]);
    expect(result.items).toEqual([req('r_2', 'survivor')]);
  });

  it('applies a deletion made on both sides', () => {
    const base = [req('r_1', 'doomed'), req('r_2', 'survivor')];
    const remaining = [req('r_2', 'survivor')];

    const result = mergeItems(base, remaining, remaining);

    expect(result.conflicts).toEqual([]);
    expect(result.items).toEqual(remaining);
  });

  it('applies a field removed on one side', () => {
    const base = [req('r_1', 'text', { category: ['functional'] })];
    const ours = [req('r_1', 'text')];
    const theirs = base;

    const result = mergeItems(base, ours, theirs);

    expect(result.conflicts).toEqual([]);
    expect(result.items).toEqual([req('r_1', 'text')]);
    expect('category' in result.items[0]).toBe(false);
  });

  it('does not treat a difference in item order as a conflict (MRG-4)', () => {
    const base = [req('r_1', 'a'), req('r_2', 'b'), req('r_3', 'c')];
    const ours = [req('r_1', 'a'), req('r_2', 'b'), req('r_3', 'c')];
    const theirs = [req('r_3', 'c'), req('r_1', 'a'), req('r_2', 'b')];

    const result = mergeItems(base, ours, theirs);

    expect(result.conflicts).toEqual([]);
    expect(result.items.map((i) => i.id).sort()).toEqual(['r_1', 'r_2', 'r_3']);
    expect(result.items).toHaveLength(3);
  });

  it('places an item added by the other side next to the neighbour it followed', () => {
    const base = [req('r_1', 'a'), req('r_2', 'b')];
    const ours = [req('r_1', 'a'), req('r_2', 'b')];
    const theirs = [req('r_1', 'a'), req('r_new', 'inserted'), req('r_2', 'b')];

    const result = mergeItems(base, ours, theirs);

    expect(result.items.map((i) => i.id)).toEqual(['r_1', 'r_new', 'r_2']);
  });

  it('places an item the other side added at the top at the top', () => {
    const base = [req('r_1', 'a')];
    const theirs = [req('r_new', 'first'), req('r_1', 'a')];

    const result = mergeItems(base, base, theirs);

    expect(result.items.map((i) => i.id)).toEqual(['r_new', 'r_1']);
  });

  it('compares array fields order-insensitively, as the diff does', () => {
    const base = [req('r_1', 'text', { category: ['functional', 'security'] })];
    const ours = [req('r_1', 'text', { category: ['security', 'functional'] })];
    const theirs = [req('r_1', 'changed', { category: ['functional', 'security'] })];

    const result = mergeItems(base, ours, theirs);

    expect(result.conflicts).toEqual([]);
    expect(result.items[0].text).toBe('changed');
  });
});

describe('mergeItems — conflicts', () => {
  it('reports a conflict when both sides set the same field differently (MRG-2)', () => {
    const base = [req('r_1', 'the system shall store')];
    const ours = [req('r_1', 'the system shall persist')];
    const theirs = [req('r_1', 'the system shall retain')];

    const result = mergeItems(base, ours, theirs);

    expect(result.clean).toBe(false);
    expect(result.conflicts).toEqual([
      {
        itemId: 'r_1',
        kind: 'field',
        field: 'text',
        base: 'the system shall store',
        ours: 'the system shall persist',
        theirs: 'the system shall retain',
      },
    ]);
  });

  it('leaves our value in place for a conflicting field so the document stays valid', () => {
    const base = [req('r_1', 'base')];
    const result = mergeItems(base, [req('r_1', 'ours')], [req('r_1', 'theirs')]);

    expect(result.items).toEqual([req('r_1', 'ours')]);
  });

  it('conflicts per field, not per item', () => {
    const base = [req('r_1', 'base', { code: 'REQ-1' })];
    const ours = [req('r_1', 'ours', { code: 'OURS-1' })];
    const theirs = [req('r_1', 'theirs', { code: 'THEIRS-1' })];

    const result = mergeItems(base, ours, theirs);

    const fields = result.conflicts
      .filter((c): c is FieldConflict => c.kind === 'field')
      .map((c) => c.field);
    expect(fields.sort()).toEqual(['code', 'text']);
  });

  it('reports a conflict when one side deletes an item the other modified (MRG-3)', () => {
    const base = [req('r_1', 'original')];
    const ours = [req('r_1', 'ours edited')];
    const theirs: SrsItem[] = [];

    const result = mergeItems(base, ours, theirs);

    expect(result.clean).toBe(false);
    expect(result.conflicts).toEqual([
      {
        itemId: 'r_1',
        kind: 'delete-modify',
        deletedBy: 'theirs',
        ours: req('r_1', 'ours edited'),
        theirs: null,
      },
    ]);
  });

  it('keeps the surviving item when a deletion conflicts with a modification (MRG-3)', () => {
    const base = [req('r_1', 'original')];
    const result = mergeItems(base, [req('r_1', 'ours edited')], []);

    expect(result.items).toEqual([req('r_1', 'ours edited')]);
  });

  it('reports the mirrored delete/modify conflict when we are the deleting side', () => {
    const base = [req('r_1', 'original')];
    const result = mergeItems(base, [], [req('r_1', 'theirs edited')]);

    expect(result.conflicts).toEqual([
      {
        itemId: 'r_1',
        kind: 'delete-modify',
        deletedBy: 'ours',
        ours: null,
        theirs: req('r_1', 'theirs edited'),
      },
    ]);
    expect(result.items).toEqual([req('r_1', 'theirs edited')]);
  });

  it('conflicts when both sides add the same id with different content', () => {
    const base: SrsItem[] = [];
    const ours = [req('r_1', 'ours version')];
    const theirs = [req('r_1', 'theirs version')];

    const result = mergeItems(base, ours, theirs);

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({ itemId: 'r_1', kind: 'field', field: 'text' });
  });

  it('does not conflict when both sides add the same id with identical content', () => {
    const base: SrsItem[] = [];
    const added = [req('r_1', 'same')];

    expect(mergeItems(base, added, added).conflicts).toEqual([]);
  });
});

describe('mergeItems — purity (MRG-1)', () => {
  it('never mutates its inputs', () => {
    const base = [req('r_1', 'base', { category: ['functional'] })];
    const ours = [req('r_1', 'ours', { category: ['functional', 'security'] })];
    const theirs = [req('r_1', 'base', { category: ['alarms'] })];
    const snapshot = JSON.stringify({ base, ours, theirs });

    mergeItems(base, ours, theirs);

    expect(JSON.stringify({ base, ours, theirs })).toBe(snapshot);
  });

  it('is deterministic for identical inputs', () => {
    const base = [req('r_1', 'a'), req('r_2', 'b')];
    const ours = [req('r_1', 'a2'), req('r_2', 'b')];
    const theirs = [req('r_2', 'b2'), req('r_1', 'a'), req('r_3', 'c')];

    expect(mergeItems(base, ours, theirs)).toEqual(mergeItems(base, ours, theirs));
  });
});

describe('mergeDocs', () => {
  it('merges the items of two divergent documents', () => {
    const base = doc([req('r_1', 'base')]);
    const ours = doc([req('r_1', 'base'), req('r_2', 'ours added')]);
    const theirs = doc([req('r_1', 'theirs edited')]);

    const result = mergeDocs(base, ours, theirs);

    expect(result.conflicts).toEqual([]);
    expect(result.doc.items).toEqual([req('r_1', 'theirs edited'), req('r_2', 'ours added')]);
    expect(result.doc.type).toBe('srs');
  });

  it('merges an envelope field changed on one side only', () => {
    const base = doc([]);
    const theirs = { ...doc([]), title: 'Software Requirements' };

    const result = mergeDocs(base, base, theirs);

    expect(result.conflicts).toEqual([]);
    expect(result.doc.title).toBe('Software Requirements');
  });

  it('reports an envelope conflict against a null item id', () => {
    const base = doc([]);
    const ours = { ...doc([]), title: 'Ours' };
    const theirs = { ...doc([]), title: 'Theirs' };

    const result = mergeDocs(base, ours, theirs);

    expect(result.conflicts).toEqual([
      { itemId: null, kind: 'field', field: 'title', base: 'Requirements', ours: 'Ours', theirs: 'Theirs' },
    ]);
  });

  it('refuses to merge documents of different types', () => {
    const base = doc([]);
    const other = { ...doc([]), type: 'vtp' } as unknown as SrsDoc;

    expect(() => mergeDocs(base, base, other)).toThrow(/different types/);
  });
});
