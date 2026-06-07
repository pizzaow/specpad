import { describe, it, expect } from 'vitest';
import { diffItems, diffDocs } from '../diff';
import type { SrsDoc, SrsItem, VtpDoc } from '../schema';

function srs(items: SrsItem[]): SrsDoc {
  return { schemaVersion: '1.0', type: 'srs', name: 'AcmeApp', title: 'Reqs', items };
}

const base: SrsItem[] = [
  { id: 'r_001', code: 'FUNC-1', text: 'Authenticate users.', tags: ['auth'] },
  { id: 'r_002', code: 'FUNC-2', text: 'Log out users.' },
];

describe('diffItems', () => {
  it('reports an added item (present in new, absent in old)', () => {
    const next = [...base, { id: 'r_003', text: 'Reset password.' }];
    const d = diffItems(base, next);
    expect(d.added.map((c) => c.id)).toEqual(['r_003']);
    expect(d.added[0].after?.text).toBe('Reset password.');
    expect(d.removed).toEqual([]);
    expect(d.modified).toEqual([]);
  });

  it('reports a removed item (present in old, absent in new)', () => {
    const next = [base[0]];
    const d = diffItems(base, next);
    expect(d.removed.map((c) => c.id)).toEqual(['r_002']);
    expect(d.removed[0].before?.text).toBe('Log out users.');
    expect(d.added).toEqual([]);
  });

  it('reports a modified item with the exact changed fields', () => {
    const next: SrsItem[] = [{ ...base[0], text: 'Authenticate all users.' }, base[1]];
    const d = diffItems(base, next);
    expect(d.modified.map((c) => c.id)).toEqual(['r_001']);
    expect(d.modified[0].changedFields).toEqual(['text']);
    expect(d.modified[0].before?.text).toBe('Authenticate users.');
    expect(d.modified[0].after?.text).toBe('Authenticate all users.');
  });

  it('treats an added optional field as a change to that field', () => {
    const next: SrsItem[] = [{ ...base[1], hazards: ['SEC-1'] }, base[0]];
    const d = diffItems(base, next);
    const mod = d.modified.find((c) => c.id === 'r_002');
    expect(mod?.changedFields).toEqual(['hazards']);
  });

  it('keys on id: renaming code is a modification, never an add+remove', () => {
    const next: SrsItem[] = [{ ...base[0], code: 'AUTH-1' }, base[1]];
    const d = diffItems(base, next);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.modified.map((c) => c.id)).toEqual(['r_001']);
    expect(d.modified[0].changedFields).toEqual(['code']);
  });

  it('keys on id: reordering items is not a change', () => {
    const next = [base[1], base[0]];
    const d = diffItems(base, next);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.modified).toEqual([]);
  });

  it('compares array fields order-insensitively (whole-field)', () => {
    const old: SrsItem[] = [{ id: 'r_1', text: 'x', tags: ['a', 'b'] }];
    const next: SrsItem[] = [{ id: 'r_1', text: 'x', tags: ['b', 'a'] }];
    expect(diffItems(old, next).modified).toEqual([]);
  });

  it('flags an array field when its membership actually changes', () => {
    const old: SrsItem[] = [{ id: 'r_1', text: 'x', tags: ['a', 'b'] }];
    const next: SrsItem[] = [{ id: 'r_1', text: 'x', tags: ['a', 'c'] }];
    expect(diffItems(old, next).modified[0].changedFields).toEqual(['tags']);
  });

  it('treats an empty baseline as everything added', () => {
    const d = diffItems([], base);
    expect(d.added.map((c) => c.id)).toEqual(['r_001', 'r_002']);
    expect(d.removed).toEqual([]);
    expect(d.modified).toEqual([]);
  });

  it('diffs heading items by id like any other item', () => {
    const old: SrsItem[] = [{ id: 'h_1', heading: true, text: 'Functional' }];
    const next: SrsItem[] = [{ id: 'h_1', heading: true, text: 'Functional Requirements' }];
    expect(diffItems(old, next).modified[0].changedFields).toEqual(['text']);
  });
});

describe('diffDocs', () => {
  it('diffs two documents of the same type via their items', () => {
    const d = diffDocs(srs(base), srs([...base, { id: 'r_003', text: 'New.' }]));
    expect(d.added.map((c) => c.id)).toEqual(['r_003']);
  });

  it('throws when the two documents are of different types', () => {
    const vtp: VtpDoc = { schemaVersion: '1.0', type: 'vtp', name: 'A', title: 'T', items: [] };
    expect(() => diffDocs(srs(base), vtp)).toThrow(/different types/);
  });
});
