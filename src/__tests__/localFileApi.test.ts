import { describe, it, expect } from 'vitest';
import { parseDocument, serializeDocument, snapshotDirSegments, classifyDocFilename } from '../localFileApi';
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

describe('classifyDocFilename', () => {
  it('recognizes srs/vtp/proj/prd document filenames', () => {
    expect(classifyDocFilename('Acme.srs.json')).toEqual({ type: 'srs', name: 'Acme', filename: 'Acme.srs.json' });
    expect(classifyDocFilename('Acme.prd.json')).toEqual({ type: 'prd', name: 'Acme', filename: 'Acme.prd.json' });
    expect(classifyDocFilename('Acme.proj.json')?.type).toBe('proj');
  });

  it('returns null for non-document files', () => {
    expect(classifyDocFilename('Acme.sad.md')).toBeNull();
    expect(classifyDocFilename('notes.txt')).toBeNull();
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
