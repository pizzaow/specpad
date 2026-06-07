import { describe, it, expect } from 'vitest';
import { rowStatusClass, isCellChanged, attributionLabel, cachedReleases } from '../changeTrackingView';
import type { AttributionView } from '../changeTracking';
import type { ReleasesDoc } from '../shared';

describe('rowStatusClass', () => {
  it('marks headings info regardless of redline', () => {
    expect(rowStatusClass(true, { status: 'modified', changedFields: ['text'] })).toBe('info');
  });
  it('maps added → success, modified → warning, none → empty', () => {
    expect(rowStatusClass(false, { status: 'added' })).toBe('success');
    expect(rowStatusClass(false, { status: 'modified' })).toBe('warning');
    expect(rowStatusClass(false, undefined)).toBe('');
  });
});

describe('isCellChanged', () => {
  it('is true only for a modified entry whose changedFields includes the field', () => {
    expect(isCellChanged({ status: 'modified', changedFields: ['text', 'tags'] }, 'text')).toBe(true);
    expect(isCellChanged({ status: 'modified', changedFields: ['tags'] }, 'text')).toBe(false);
    expect(isCellChanged({ status: 'added' }, 'text')).toBe(false);
    expect(isCellChanged(undefined, 'text')).toBe(false);
  });
});

describe('attributionLabel', () => {
  const sam = { name: 'Sam', email: 's@x.com' };
  it('returns "new" when there is no attribution', () => {
    expect(attributionLabel(undefined)).toBe('new');
  });
  it('shows a boundary add with author when added==lastChanged', () => {
    const a: AttributionView = { addedIn: 'v1.0', addedBoundary: true, lastChangedIn: 'v1.0', author: sam };
    expect(attributionLabel(a)).toBe('≤v1.0 · Sam');
  });
  it('shows added and changed separately when they differ', () => {
    const a: AttributionView = { addedIn: 'v1.0', addedBoundary: false, lastChangedIn: 'v2.0', author: sam };
    expect(attributionLabel(a)).toBe('added v1.0 · changed v2.0 · Sam');
  });
});

describe('cachedReleases', () => {
  const sam = { name: 'Sam', email: 's@x.com' };
  const releases: ReleasesDoc = {
    schemaVersion: '1.0', type: 'releases', name: 'AcmeApp', tagPattern: 'v*', baseline: 'v2.0',
    releases: [
      { version: 'v1.0', ref: 'v1.0', date: '2025-01-01', author: sam, snapshot: '.specpad/snapshots/v1.0' },
      { version: 'v1.5', ref: 'v1.5', date: '2025-06-01', author: sam, snapshot: null },
      { version: 'v2.0', ref: 'v2.0', date: '2026-01-01', author: sam, snapshot: '.specpad/baseline' },
    ],
  };
  it('returns null releases as an empty list', () => {
    expect(cachedReleases(null)).toEqual([]);
  });
  it('keeps only cached releases, mapping the baseline version to the baseline location', () => {
    expect(cachedReleases(releases)).toEqual([
      { version: 'v1.0', author: sam, location: { version: 'v1.0' } },
      { version: 'v2.0', author: sam, location: 'baseline' },
    ]);
  });
});
