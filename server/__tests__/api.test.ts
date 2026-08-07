import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleApi, versionTag } from '../api';
import type { ApiRequest } from '../api';
import { validateConfig } from '../config';
import type { ServerConfig, Role } from '../config';
import type { Session } from '../auth';
import type { WorkingCopy } from '../workingCopy';
import type { SrsDoc } from '../../src/shared';

// SRV-4 and EDR-3: the browser's read-only rendering is a courtesy; this is the
// enforcement point.

const srs: SrsDoc = {
  schemaVersion: '1.0',
  type: 'srs',
  name: 'acme',
  title: 'Requirements',
  items: [{ id: 'r_1', text: 'The system shall work.' }],
};

function config(): ServerConfig {
  const { config: c } = validateConfig({
    repo: { url: 'git@x:y.git', branch: 'main' },
    workDir: '/srv/specpad',
    auth: {
      provider: 'proxy',
      trustedPeers: ['10.0.0.0/8'],
      roles: { committer: ['grp-quality'], editor: ['grp-eng'], reader: ['grp-all'] },
    },
  });
  if (!c) throw new Error('bad test config');
  return c;
}

function session(role: Role): Session {
  return {
    principal: { id: 'jane', displayName: 'Jane Smith', email: 'jane@corp.example', groups: [] },
    role,
  };
}

function makeWorkingCopy() {
  return {
    listDocuments: vi.fn(async () => [{ type: 'srs', name: 'acme', filename: 'acme.srs.json' }]),
    projectName: vi.fn(async () => 'acme'),
    readJson: vi.fn(async () => srs as unknown),
    readText: vi.fn(async () => '# Architecture'),
    writeText: vi.fn(async () => undefined),
    status: vi.fn(async () => ({ changed: ['docs/specpad/acme.srs.json'], dirty: true })),
    pendingDiff: vi.fn(async () => [
      {
        path: 'docs/specpad/acme.srs.json',
        kind: 'register' as const,
        added: [],
        modified: ['REQ-14'],
        removed: [],
      },
    ]),
    bundle: vi.fn(async () => ({ srs, job: { schemaVersion: '1.0', type: 'job', jobs: ['j_1'] } })),
    publish: vi.fn(async () => ({ ok: true, commit: 'abc123' })),
    discard: vi.fn(async () => undefined),
  };
}

type FakeWorkingCopy = ReturnType<typeof makeWorkingCopy>;

let wc: FakeWorkingCopy;

const call = (req: Partial<ApiRequest>, role: Role = 'committer') =>
  handleApi(
    { method: 'GET', path: '/', query: new URLSearchParams(), ...req },
    session(role),
    wc as unknown as WorkingCopy,
    config(),
  );

beforeEach(() => {
  wc = makeWorkingCopy();
});

describe('GET /session (EDR-2)', () => {
  it('returns the signed-in identity, role, and capabilities', async () => {
    const res = await call({ path: '/session' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      principal: { displayName: 'Jane Smith', email: 'jane@corp.example' },
      role: 'committer',
      capabilities: { read: true, write: true, commit: true },
      repo: { branch: 'main', projectDir: 'docs/specpad' },
      project: 'acme',
    });
  });

  it('reports reduced capabilities for a reader', async () => {
    const res = await call({ path: '/session' }, 'reader');

    expect(res.body).toMatchObject({
      capabilities: { read: true, write: false, commit: false },
    });
  });
});

describe('reads (SRV-4)', () => {
  it('lists documents', async () => {
    const res = await call({ path: '/documents' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      documents: [{ type: 'srs', name: 'acme', filename: 'acme.srs.json' }],
    });
  });

  it('returns a document with a version tag', async () => {
    const res = await call({ path: '/doc/acme.srs.json' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ doc: srs, version: versionTag(srs) });
  });

  it('404s a document that is not there', async () => {
    wc.readJson.mockResolvedValueOnce(null);

    expect((await call({ path: '/doc/acme.vtp.json' })).status).toBe(404);
  });

  it('reports the pending change set at item level for the Commit dialog (CMT-7)', async () => {
    const res = await call({ path: '/status' });

    expect(res.body).toEqual({
      changed: ['docs/specpad/acme.srs.json'],
      dirty: true,
      diff: [
        {
          path: 'docs/specpad/acme.srs.json',
          kind: 'register',
          added: [],
          modified: ['REQ-14'],
          removed: [],
        },
      ],
    });
  });

  it('skips the item-level diff when there is nothing pending', async () => {
    wc.status.mockResolvedValueOnce({ changed: [], dirty: false });

    const res = await call({ path: '/status' });

    expect(res.body).toEqual({ changed: [], dirty: false, diff: [] });
    expect(wc.pendingDiff).not.toHaveBeenCalled();
  });

  it('rejects a path that escapes the project root (SRV-2)', async () => {
    wc.readJson.mockImplementation(async () => {
      const { PathError } = await import('../paths');
      throw new PathError('Path escapes the project root: ../../src/index.tsx');
    });

    const res = await call({ path: '/doc/..%2F..%2Fsrc%2Findex.tsx' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.stringMatching(/escapes the project root/) });
  });
});

describe('writes and roles (EDR-3)', () => {
  it('accepts a write from an editor', async () => {
    const res = await call({
      method: 'PUT',
      path: '/doc/acme.srs.json',
      body: { doc: srs, version: versionTag(srs) },
    }, 'editor');

    expect(res.status).toBe(200);
    expect(wc.writeText).toHaveBeenCalled();
  });

  it('refuses a write from a reader whatever the client rendered', async () => {
    const res = await call({ method: 'PUT', path: '/doc/acme.srs.json', body: { doc: srs } }, 'reader');

    expect(res.status).toBe(403);
    expect(wc.writeText).not.toHaveBeenCalled();
  });

  it('refuses a commit from an editor', async () => {
    const res = await call({ method: 'POST', path: '/commit', body: { message: 'x' } }, 'editor');

    expect(res.status).toBe(403);
    expect(wc.publish).not.toHaveBeenCalled();
  });

  it('rejects a malformed write body', async () => {
    const res = await call({ method: 'PUT', path: '/doc/acme.srs.json', body: { doc: 'nope' } });

    expect(res.status).toBe(400);
  });
});

describe('optimistic concurrency (CE-1)', () => {
  it('rejects a write carrying a stale version tag', async () => {
    const res = await call({
      method: 'PUT',
      path: '/doc/acme.srs.json',
      body: { doc: { ...srs, title: 'Mine' }, version: 'deadbeef' },
    });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ version: versionTag(srs) });
    expect(wc.writeText).not.toHaveBeenCalled();
  });

  it('accepts a write carrying the current version tag', async () => {
    const res = await call({
      method: 'PUT',
      path: '/doc/acme.srs.json',
      body: { doc: { ...srs, title: 'Mine' }, version: versionTag(srs) },
    });

    expect(res.status).toBe(200);
    expect(wc.writeText).toHaveBeenCalled();
  });

  it('derives the tag from content, so identical content tags identically', () => {
    expect(versionTag(srs)).toBe(versionTag({ ...srs }));
    expect(versionTag(srs)).not.toBe(versionTag({ ...srs, title: 'Different' }));
  });
});

describe('POST /commit (CMT-3)', () => {
  it('publishes and returns the new commit', async () => {
    const res = await call({ method: 'POST', path: '/commit', body: { message: 'Clarify REQ-14' } });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, commit: 'abc123' });
    expect(wc.publish).toHaveBeenCalledWith(expect.objectContaining({ email: 'jane@corp.example' }), 'Clarify REQ-14');
  });

  it('requires a commit message', async () => {
    expect((await call({ method: 'POST', path: '/commit', body: { message: '  ' } })).status).toBe(400);
    expect(wc.publish).not.toHaveBeenCalled();
  });

  it('returns 409 with the gate result when the commit is refused (CMT-4)', async () => {
    wc.publish.mockResolvedValueOnce({
      ok: false,
      gate: { ok: false, blocked: ['traceability: r_2 has no verifying test'], warnings: [], governance: [] },
    } as any);

    const res = await call({ method: 'POST', path: '/commit', body: { message: 'x' } });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ ok: false, gate: { blocked: expect.any(Array) } });
  });

  it('returns 409 with per-field conflicts when a merge needs a human (MRG-6)', async () => {
    wc.publish.mockResolvedValueOnce({
      ok: false,
      conflicts: [{ itemId: 'r_1', kind: 'field', field: 'text', base: 'a', ours: 'b', theirs: 'c' }],
    } as any);

    const res = await call({ method: 'POST', path: '/commit', body: { message: 'x' } });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      conflicts: [{ itemId: 'r_1', field: 'text', ours: 'b', theirs: 'c' }],
    });
  });
});

describe('POST /discard (CMT-7)', () => {
  it('reverts the working copy and returns the fresh status', async () => {
    wc.status.mockResolvedValueOnce({ changed: [], dirty: false });

    const res = await call({ method: 'POST', path: '/discard' });

    expect(wc.discard).toHaveBeenCalled();
    expect(res.body).toEqual({ changed: [], dirty: false });
  });
});

describe('unknown endpoints', () => {
  it('404s rather than falling through', async () => {
    expect((await call({ path: '/nope' })).status).toBe(404);
  });
});
