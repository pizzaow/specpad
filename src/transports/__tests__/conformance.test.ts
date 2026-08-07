import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalTransport } from '../local';
import { DemoTransport } from '../demo';
import type { FileApi } from '../types';
import type { SrsDoc } from '../../shared';

/**
 * One suite, every transport (EDR-1). The editor reaches storage only through this
 * contract, so a transport that passes here can back the whole editor — and a new
 * transport is proven by adding one entry to `TRANSPORTS` rather than a new suite.
 */

const srsDoc: SrsDoc = {
  schemaVersion: '1.0',
  type: 'srs',
  name: 'acme',
  title: 'Requirements',
  items: [{ id: 'r_001', text: 'A requirement' }],
};

/** A fake FileSystemDirectoryHandle over a flat path→content map. */
function makeFakeDir(files: Record<string, string>) {
  const notFound = (): never => {
    const e: any = new Error('not found');
    e.name = 'NotFoundError';
    throw e;
  };
  const makeDirAt = (prefix: string): any => ({
    kind: 'directory',
    name: prefix || 'root',
    async requestPermission() {
      return 'granted';
    },
    async queryPermission() {
      return 'granted';
    },
    async *values() {
      for (const path of Object.keys(files)) {
        if (path.startsWith(prefix) && !path.slice(prefix.length).includes('/')) {
          yield { kind: 'file', name: path.slice(prefix.length) };
        }
      }
    },
    async getFileHandle(name: string, opts?: { create?: boolean }) {
      const full = prefix + name;
      if (!(full in files) && !opts?.create) notFound();
      return {
        getFile: async () => ({ text: async () => files[full] }),
        createWritable: async () => ({
          write: async (content: string) => {
            files[full] = content;
          },
          close: async () => {},
          abort: async () => {},
        }),
      };
    },
    async getDirectoryHandle(name: string, opts?: { create?: boolean }) {
      const nested = `${prefix}${name}/`;
      const exists = Object.keys(files).some((p) => p.startsWith(nested));
      if (!exists && !opts?.create) notFound();
      return makeDirAt(nested);
    },
  });
  return makeDirAt('');
}

interface Harness {
  name: string;
  /** Build a transport pre-loaded with `files` (path → content). */
  open(files: Record<string, string>): Promise<FileApi>;
  /** Whether this transport accepts writes. */
  writable: boolean;
}

const TRANSPORTS: Harness[] = [
  {
    name: 'local (File System Access)',
    writable: true,
    async open(files) {
      const transport = new LocalTransport();
      await transport.openFromHandle(makeFakeDir({ ...files }));
      return transport;
    },
  },
  {
    name: 'demo (read-only HTTP)',
    writable: false,
    async open(files) {
      const documents = Object.keys(files).filter((p) => !p.includes('/'));
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          const path = url.replace(/^\/base\//, '');
          if (path === 'manifest.json') {
            return {
              ok: true,
              status: 200,
              json: async () => ({ documents }),
              text: async () => JSON.stringify({ documents }),
            } as unknown as Response;
          }
          if (path in files) {
            return {
              ok: true,
              status: 200,
              text: async () => files[path],
              json: async () => JSON.parse(files[path]),
            } as unknown as Response;
          }
          return { ok: false, status: 404, text: async () => '', json: async () => ({}) } as unknown as Response;
        }),
      );
      const transport = new DemoTransport('/base/');
      await transport.open();
      return transport;
    },
  },
];

const PROJECT_FILES = {
  'acme.proj.json': JSON.stringify({ schemaVersion: '1.0', type: 'project', name: 'acme', title: 'Acme', documents: [] }),
  'acme.srs.json': JSON.stringify(srsDoc),
  'acme.sad.md': '# Architecture',
  '.specpad/baseline/acme.srs.json': JSON.stringify(srsDoc),
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each(TRANSPORTS)('FileApi conformance — $name', (harness) => {
  let files: Record<string, string>;
  let transport: FileApi;

  beforeEach(async () => {
    files = { ...PROJECT_FILES };
    transport = await harness.open(files);
  });

  it('reports an open project', () => {
    expect(transport.isOpen()).toBe(true);
  });

  it('lists the project documents, classified by type', async () => {
    const documents = await transport.listDocuments();
    expect(documents.map((d) => d.type).sort()).toEqual(['proj', 'srs']);
    expect(documents.every((d) => d.name === 'acme')).toBe(true);
  });

  it('does not list non-document files', async () => {
    const documents = await transport.listDocuments();
    expect(documents.map((d) => d.filename)).not.toContain('acme.sad.md');
  });

  it('reads a JSON document', async () => {
    expect(await transport.readJson(['acme.srs.json'])).toEqual(srsDoc);
  });

  it('reads a JSON document from a nested path', async () => {
    expect(await transport.readJson(['.specpad', 'baseline', 'acme.srs.json'])).toEqual(srsDoc);
  });

  it('resolves an absent JSON file to null rather than throwing', async () => {
    expect(await transport.readJson(['acme.vtp.json'])).toBeNull();
    expect(await transport.readJson(['.specpad', 'nope', 'acme.srs.json'])).toBeNull();
  });

  it('reads a text file', async () => {
    expect(await transport.readText(['acme.sad.md'])).toBe('# Architecture');
  });

  it('resolves an unresolvable text reference to null (DGM-4)', async () => {
    expect(await transport.readText(['missing.svg'])).toBeNull();
    expect(await transport.readText(['nope', 'context.svg'])).toBeNull();
  });

  it('derives the project name from the document list', () => {
    expect(transport.projectName()).toBe('acme');
  });

  if (harness.writable) {
    it('writes a text file and reads it back', async () => {
      await transport.writeText(['acme.vtp.json'], '{"hello":true}');
      expect(await transport.readText(['acme.vtp.json'])).toBe('{"hello":true}');
    });

    it('writes into a nested path', async () => {
      await transport.writeText(['.specpad', 'run', 'acme.run.json'], '{}');
      expect(await transport.readText(['.specpad', 'run', 'acme.run.json'])).toBe('{}');
    });

    it('reports itself as writable', () => {
      expect(transport.readOnly).toBe(false);
    });
  } else {
    it('refuses writes with a read-only error', async () => {
      await expect(transport.writeText(['acme.srs.json'], '{}')).rejects.toThrow(/read-only/i);
    });

    it('reports itself as read-only', () => {
      expect(transport.readOnly).toBe(true);
    });
  }
});
