import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalTransport } from '../local';
import { DemoTransport } from '../demo';
import { connectToServer, isProjectChoice } from '../remote';
import { classifyDocFilename } from '../types';
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
  {
    name: 'remote (SpecPad server)',
    writable: true,
    async open(files) {
      vi.stubGlobal('fetch', fakeServer(files));
      const transport = await connectToServer('/api/v1');
      if (!transport || isProjectChoice(transport)) {
        throw new Error('the fake server did not answer the session probe');
      }
      return transport;
    },
  },
];

/**
 * A fake SpecPad server over the same `files` map, implementing the routes the remote
 * transport uses. Mirrors the real server's behaviour where it matters: it normalizes
 * document JSON on write, and 404s an absent path.
 */
function fakeServer(files: Record<string, string>) {
  const json = (status: number, body: unknown) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    }) as unknown as Response;

  return vi.fn(async (url: string, init?: RequestInit) => {
    const path = decodeURIComponent(url.replace(/^\/api\/v1/, ''));
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;

    if (path === '/session') {
      return json(200, {
        principal: { id: 'jane', displayName: 'Jane Smith', email: 'jane@corp.example' },
        role: 'committer',
        capabilities: { read: true, write: true, commit: true },
        repo: { branch: 'main', projectDir: 'docs/specpad' },
        project: 'acme',
        activeJob: null,
        commitPolicy: { requireActiveJob: true, requireGovernanceClean: 'warn' },
      });
    }
    if (path === '/documents') {
      const documents = Object.keys(files)
        .filter((p) => !p.includes('/'))
        .map(classifyDocFilename)
        .filter(Boolean);
      return json(200, { documents });
    }
    if (path.startsWith('/doc/')) {
      const key = path.slice('/doc/'.length);
      if (method === 'PUT') {
        files[key] = JSON.stringify(body.doc, null, 2) + '\n';
        return json(200, { version: 'v2' });
      }
      if (!(key in files)) return json(404, { error: 'Document not found.' });
      return json(200, { doc: JSON.parse(files[key]), version: 'v1' });
    }
    if (path.startsWith('/text/')) {
      const key = path.slice('/text/'.length);
      if (method === 'PUT') {
        files[key] = body.text;
        return json(200, { written: true });
      }
      if (!(key in files)) return json(404, { error: 'File not found.' });
      return json(200, { text: files[key] });
    }
    return json(404, { error: 'No such endpoint.' });
  });
}

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
    // Compared as parsed documents, not byte-for-byte: a transport may legitimately
    // normalize JSON formatting on the way through (the server does).
    it('writes a document and reads it back', async () => {
      const updated = { ...srsDoc, title: 'Updated' };
      await transport.writeText(['acme.srs.json'], JSON.stringify(updated, null, 2) + '\n');
      expect(await transport.readJson(['acme.srs.json'])).toEqual(updated);
    });

    it('writes a text file and reads it back verbatim', async () => {
      await transport.writeText(['notes.md'], '# Notes');
      expect(await transport.readText(['notes.md'])).toBe('# Notes');
    });

    it('writes into a nested path', async () => {
      await transport.writeText(['.specpad', 'run', 'acme.run.json'], '{}\n');
      expect(await transport.readJson(['.specpad', 'run', 'acme.run.json'])).toEqual({});
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
