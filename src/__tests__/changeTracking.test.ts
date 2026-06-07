import { describe, it, expect } from 'vitest';
import { buildRedline, computeAttribution } from '../changeTracking';
import type { SrsDoc, SrsItem, AuthorRef } from '../shared';

function srs(items: SrsItem[]): SrsDoc {
  return { schemaVersion: '1.0', type: 'srs', name: 'AcmeApp', title: 'Reqs', items };
}
const geoff: AuthorRef = { name: 'Geoff', email: 'g@x.com' };
const sam: AuthorRef = { name: 'Sam', email: 's@x.com' };

describe('buildRedline', () => {
  const baseItems: SrsItem[] = [
    { id: 'r_1', text: 'A' },
    { id: 'r_2', text: 'B' },
  ];

  it('returns an empty redline when there is no baseline', () => {
    const r = buildRedline(null, srs(baseItems));
    expect(r.byId.size).toBe(0);
    expect(r.removed).toEqual([]);
  });

  it('marks added, modified (with changedFields), and removed vs the baseline', () => {
    const working = srs([
      { id: 'r_1', text: 'A2' }, // modified
      { id: 'r_3', text: 'C' }, // added
    ]); // r_2 removed
    const r = buildRedline(srs(baseItems), working);
    expect(r.byId.get('r_3')).toEqual({ status: 'added' });
    expect(r.byId.get('r_1')).toEqual({ status: 'modified', changedFields: ['text'] });
    expect(r.byId.has('r_2')).toBe(false);
    expect(r.removed.map((c) => c.id)).toEqual(['r_2']);
  });
});

describe('computeAttribution', () => {
  it('returns an empty map for no snapshots', () => {
    expect(computeAttribution([]).size).toBe(0);
  });

  it('attributes everything in a single snapshot to that release, as a boundary', () => {
    const m = computeAttribution([
      { version: 'v1.0', author: geoff, doc: srs([{ id: 'r_1', text: 'A' }]) },
    ]);
    expect(m.get('r_1')).toEqual({
      addedIn: 'v1.0',
      addedBoundary: true,
      lastChangedIn: 'v1.0',
      author: geoff,
    });
  });

  it('tracks add, modify, and unchanged across two snapshots', () => {
    const m = computeAttribution([
      { version: 'v1.0', author: geoff, doc: srs([{ id: 'r_1', text: 'A' }, { id: 'r_2', text: 'B' }]) },
      { version: 'v2.0', author: sam, doc: srs([{ id: 'r_1', text: 'A2' }, { id: 'r_2', text: 'B' }, { id: 'r_3', text: 'C' }]) },
    ]);
    expect(m.get('r_1')).toEqual({ addedIn: 'v1.0', addedBoundary: true, lastChangedIn: 'v2.0', author: sam });
    expect(m.get('r_2')).toEqual({ addedIn: 'v1.0', addedBoundary: true, lastChangedIn: 'v1.0', author: geoff });
    expect(m.get('r_3')).toEqual({ addedIn: 'v2.0', addedBoundary: false, lastChangedIn: 'v2.0', author: sam });
  });

  it('drops an item removed in a later snapshot', () => {
    const m = computeAttribution([
      { version: 'v1.0', author: geoff, doc: srs([{ id: 'r_1', text: 'A' }]) },
      { version: 'v2.0', author: sam, doc: srs([]) },
    ]);
    expect(m.has('r_1')).toBe(false);
  });
});
