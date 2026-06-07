import { describe, it, expect } from 'vitest';
import { parseDocument, serializeDocument, snapshotDirSegments } from '../localFileApi';
import type { SrsDoc } from '../shared';

describe('localFileApi serialization', () => {
  it('round-trips an srs doc preserving ids', () => {
    const doc: SrsDoc = {
      schemaVersion: '1.0',
      type: 'srs',
      name: 'AcmeApp',
      title: 'Requirements',
      items: [{ id: 'r_7f3a9c', text: 'Shall work.' }],
    };
    const text = serializeDocument(doc);
    const parsed = parseDocument(text);
    expect(parsed).toEqual(doc);
    expect(text.endsWith('\n')).toBe(true);
  });

  it('parseDocument rejects malformed JSON', () => {
    expect(() => parseDocument('{not json')).toThrow();
  });
});

describe('snapshotDirSegments', () => {
  it('points "baseline" at .specpad/baseline', () => {
    expect(snapshotDirSegments('baseline')).toEqual(['.specpad', 'baseline']);
  });

  it('points a version at .specpad/snapshots/<version>', () => {
    expect(snapshotDirSegments({ version: 'v26.1' })).toEqual(['.specpad', 'snapshots', 'v26.1']);
  });
});
