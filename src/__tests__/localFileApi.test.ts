import { describe, it, expect } from 'vitest';
import {
  parseDocument,
  serializeDocument,
  snapshotDirSegments,
  classifyDocFilename,
  openProjectFromHandle,
  loadProjectText,
} from '../localFileApi';
import type { SrsDoc } from '../shared';

// A minimal fake FileSystemDirectoryHandle: `files` are readable by bare name in this
// directory, `subdirs` are nested directory handles. getFileHandle mirrors the browser,
// rejecting path-bearing / empty / dot names with a "Name is not allowed" error.
function makeDir(
  files: Record<string, string> = {},
  subdirs: Record<string, any> = {},
): any {
  const notFound = (): never => {
    const e: any = new Error('not found');
    e.name = 'NotFoundError';
    throw e;
  };
  return {
    kind: 'directory',
    name: 'root',
    async *values() {
      for (const name of Object.keys(files)) yield { kind: 'file', name };
    },
    async getFileHandle(name: string) {
      if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
        const e: any = new Error(`Failed to execute 'getFileHandle': Name is not allowed`);
        e.name = 'TypeError';
        throw e;
      }
      if (!(name in files)) notFound();
      return { getFile: async () => ({ text: async () => files[name] }) };
    },
    async getDirectoryHandle(name: string) {
      if (name in subdirs) return subdirs[name];
      return notFound();
    },
  };
}

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

describe('loadProjectText fault tolerance (DGM-4)', () => {
  it('resolves a nested reference by walking into the subdirectory', async () => {
    const diagrams = makeDir({ 'context.svg': '<svg>ctx</svg>' });
    await openProjectFromHandle(makeDir({}, { diagrams }));
    expect(await loadProjectText('diagrams/context.svg')).toBe('<svg>ctx</svg>');
    expect(await loadProjectText('./diagrams/context.svg')).toBe('<svg>ctx</svg>');
  });

  it('degrades an unresolvable reference to null instead of throwing', async () => {
    await openProjectFromHandle(makeDir({ 'foo.svg': '<svg/>' }));
    // Bare missing file, missing subdirectory, and a name the handle rejects as invalid.
    await expect(loadProjectText('missing.svg')).resolves.toBeNull();
    await expect(loadProjectText('nope/context.svg')).resolves.toBeNull();
    await expect(loadProjectText('bad\\name.svg')).resolves.toBeNull();
    // A resolvable bare reference still loads.
    expect(await loadProjectText('foo.svg')).toBe('<svg/>');
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
