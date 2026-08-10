// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { start } from '../index';

/**
 * Two projects, one server, driven over HTTP (MPT-3, MPT-4, MPT-6, MPT-7, MPT-8).
 *
 * The module-level tests prove the rules; this proves the deployment. It runs two real
 * repositories through one process and checks the boundary where it actually matters:
 * that a user's draft in one project is invisible in the other, that a project they
 * hold no role in is refused while their other project keeps working, and that an
 * editing claim in one project does not wake the people editing the other.
 */

function sh(cmd: string, args: string[], cwd: string): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd }, (error, stdout) =>
      resolve({ code: error ? 1 : 0, stdout: stdout ?? '' }),
    );
  });
}

const gitAvailable = (await sh('git', ['--version'], os.tmpdir())).code === 0;

const json = (doc: unknown) => JSON.stringify(doc, null, 2) + '\n';

const srsFor = (name: string) => ({
  schemaVersion: '1.0',
  type: 'srs',
  name,
  title: 'Requirements',
  items: [{ id: 'r_1', code: 'REQ-1', text: `The ${name} system shall store records.` }],
});

let root = '';
let shutdown: (() => Promise<void>) | null = null;
let origin = '';

const PORT = 8751;
const host = `http://127.0.0.1:${PORT}`;

/**
 * Identity is asserted by headers, as it would be behind a company's SSO gateway. Jane
 * is quality (committer in alpha, reader in beta); Raj is engineering (no role in beta).
 */
const JANE = { 'x-forwarded-user': 'jane', 'x-forwarded-email': 'jane@corp.example', 'x-forwarded-preferred-username': 'Jane Smith', 'x-forwarded-groups': 'grp-quality' };
const RAJ = { 'x-forwarded-user': 'raj', 'x-forwarded-email': 'raj@corp.example', 'x-forwarded-preferred-username': 'Raj Patel', 'x-forwarded-groups': 'grp-eng' };

async function api(
  method: string,
  route: string,
  who: Record<string, string> = JANE,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${host}/api/v1${route}`, {
    method,
    headers: { ...who, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** Seed a bare origin repository holding a minimal SpecPad project. */
async function seedRepo(name: string): Promise<string> {
  const bare = path.join(root, `${name}.git`);
  await sh('git', ['init', '--bare', '-b', 'main', bare], root);

  const seed = path.join(root, `seed-${name}`);
  await sh('git', ['clone', bare, seed], root);
  await sh('git', ['config', 'user.name', 'Seed'], seed);
  await sh('git', ['config', 'user.email', 'seed@example.com'], seed);
  const spec = path.join(seed, 'docs', 'specpad');
  await fs.mkdir(spec, { recursive: true });
  await fs.writeFile(path.join(spec, `${name}.srs.json`), json(srsFor(name)));
  await fs.writeFile(
    path.join(spec, `${name}.proj.json`),
    json({ schemaVersion: '1.0', type: 'project', name, title: name, documents: [] }),
  );
  await sh('git', ['add', '-A'], seed);
  await sh('git', ['commit', '-m', 'Seed'], seed);
  await sh('git', ['push', 'origin', 'main'], seed);
  return bare;
}

/**
 * Collect server-sent events for a while. Returns the parsed frames, so a test can
 * assert both what arrived and — just as importantly here — what did not.
 */
async function collectEvents(
  route: string,
  ms: number,
  during: () => Promise<void>,
): Promise<{ event: string; data: any }[]> {
  const controller = new AbortController();
  const res = await fetch(`${host}/api/v1${route}`, {
    headers: JANE,
    signal: controller.signal,
  });
  const frames: { event: string; data: any }[] = [];

  const reading = (async () => {
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';
        for (const chunk of chunks) {
          const event = /^event: (.+)$/m.exec(chunk)?.[1];
          const data = chunk
            .split('\n')
            .filter((l) => l.startsWith('data: '))
            .map((l) => l.slice(6))
            .join('\n');
          if (event) frames.push({ event, data: data ? JSON.parse(data) : null });
        }
      }
    } catch {
      /* aborted */
    }
  })();

  await during();
  await new Promise((resolve) => setTimeout(resolve, ms));
  controller.abort();
  await reading;
  return frames;
}

beforeAll(async () => {
  if (!gitAvailable) return;

  root = await fs.mkdtemp(path.join(os.tmpdir(), 'specpad-multi-'));
  origin = await seedRepo('alpha');
  const betaOrigin = await seedRepo('beta');

  const editorDir = path.join(root, 'dist');
  await fs.mkdir(editorDir, { recursive: true });
  await fs.writeFile(path.join(editorDir, 'index.html'), '<!doctype html><title>SpecPad</title>');
  process.env.SPECPAD_EDITOR_DIR = editorDir;

  const configPath = path.join(root, 'config.json');
  await fs.writeFile(
    configPath,
    JSON.stringify({
      projects: [
        {
          id: 'alpha',
          title: 'Alpha Device',
          url: origin,
          branch: 'main',
          paths: ['docs/specpad'],
          roles: { committer: ['grp-quality'], editor: ['grp-eng'] },
        },
        {
          id: 'beta',
          title: 'Beta Device',
          url: betaOrigin,
          branch: 'main',
          paths: ['docs/specpad'],
          // Engineering has no role here at all — the interesting case (MPT-6).
          roles: { reader: ['grp-quality'] },
        },
      ],
      auth: { provider: 'proxy', trustedPeers: ['127.0.0.1'] },
      commit: { requireActiveJob: false, requireGovernanceClean: 'off', pushRetries: 3 },
      workDir: path.join(root, 'srv'),
      port: PORT,
      bind: '127.0.0.1',
    }),
  );

  const running = await start(configPath);
  shutdown = running.shutdown;
}, 120_000);

afterAll(async () => {
  if (shutdown) await shutdown();
  delete process.env.SPECPAD_EDITOR_DIR;
  if (root) await fs.rm(root, { recursive: true, force: true }).catch(() => undefined);
}, 20_000);

describe.skipIf(!gitAvailable)('one server, several projects (MPT-3)', () => {
  it('serves each project from its own repository', async () => {
    const alpha = await api('GET', '/p/alpha/session');
    const beta = await api('GET', '/p/beta/session');

    expect(alpha.status).toBe(200);
    expect(alpha.body).toMatchObject({ projectId: 'alpha', project: 'alpha' });
    expect(beta.status).toBe(200);
    expect(beta.body).toMatchObject({ projectId: 'beta', project: 'beta' });
  });

  it('reads the right document from each project', async () => {
    const alpha = await api('GET', '/p/alpha/doc/alpha.srs.json');
    const beta = await api('GET', '/p/beta/doc/beta.srs.json');

    expect(alpha.body.doc.items[0].text).toContain('alpha');
    expect(beta.body.doc.items[0].text).toContain('beta');
  });

  it('refuses a request that names no project, listing what may be opened instead', async () => {
    const res = await api('GET', '/session');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/several projects/i);
    expect(res.body.projects.map((p: any) => p.id)).toEqual(['alpha', 'beta']);
  });

  it('refuses an unknown project by name', async () => {
    const res = await api('GET', '/p/nope/session');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('nope');
  });
});

describe.skipIf(!gitAvailable)('working copies are per project (MPT-4)', () => {
  it("does not leak one project's uncommitted draft into another", async () => {
    const before = await api('GET', '/p/alpha/doc/alpha.srs.json');
    const edited = {
      ...before.body.doc,
      items: [{ ...before.body.doc.items[0], text: 'A draft only Jane has seen.' }],
    };
    const write = await api('PUT', '/p/alpha/doc/alpha.srs.json', JANE, {
      doc: edited,
      version: before.body.version,
    });
    expect(write.status).toBe(200);

    // Alpha is dirty for Jane; beta knows nothing about it.
    expect((await api('GET', '/p/alpha/status')).body.dirty).toBe(true);
    expect((await api('GET', '/p/beta/status')).body.dirty).toBe(false);
    expect((await api('GET', '/p/beta/doc/beta.srs.json')).body.doc.items[0].text).toContain(
      'beta',
    );

    await api('POST', '/p/alpha/discard');
  });

  it('gives each project its own directory of per-user worktrees', async () => {
    await api('GET', '/p/alpha/session');
    await api('GET', '/p/beta/session');

    const projects = path.join(root, 'srv', 'projects');
    expect((await fs.readdir(projects)).sort()).toEqual(['alpha', 'beta']);
    // Each holds its own bare clone, so the two can never share a checkout.
    expect(await fs.stat(path.join(projects, 'alpha', 'repo.git')).then((s) => s.isDirectory())).toBe(
      true,
    );
    expect(await fs.stat(path.join(projects, 'beta', 'repo.git')).then((s) => s.isDirectory())).toBe(
      true,
    );
  });
});

describe.skipIf(!gitAvailable)('a role in one project is not a role in another (MPT-6)', () => {
  it('refuses the project the user has no role in, and serves the one they do', async () => {
    const refused = await api('GET', '/p/beta/session', RAJ);
    const served = await api('GET', '/p/alpha/session', RAJ);

    expect(refused.status).toBe(403);
    expect(refused.body.error).toContain('Beta Device');
    expect(served.status).toBe(200);
    expect(served.body.role).toBe('editor');
  });

  it('enforces the per-project role on writes, not just on the session', async () => {
    // Jane is only a reader in beta, whatever her role in alpha.
    const beta = await api('GET', '/p/beta/doc/beta.srs.json');
    const write = await api('PUT', '/p/beta/doc/beta.srs.json', JANE, {
      doc: beta.body.doc,
      version: beta.body.version,
    });

    expect(write.status).toBe(403);
    expect((await api('GET', '/p/alpha/session')).body.capabilities.commit).toBe(true);
  });
});

describe.skipIf(!gitAvailable)('project discovery (MPT-7)', () => {
  it('lists the projects the caller may read, with their role in each', async () => {
    const res = await api('GET', '/projects');

    expect(res.status).toBe(200);
    expect(res.body.projects).toEqual([
      { id: 'alpha', title: 'Alpha Device', branch: 'main', role: 'committer' },
      { id: 'beta', title: 'Beta Device', branch: 'main', role: 'reader' },
    ]);
  });

  it('omits a project the caller holds no role in rather than listing it as refused', async () => {
    const res = await api('GET', '/projects', RAJ);

    expect(res.body.projects.map((p: any) => p.id)).toEqual(['alpha']);
  });

  it('answers without the caller having to name a project', async () => {
    // The whole point: this is what an editor calls before it knows where to go.
    expect((await api('GET', '/projects')).status).toBe(200);
  });
});

describe.skipIf(!gitAvailable)('events are scoped to one project (MPT-8)', () => {
  it("does not wake a project's subscribers with another project's presence", async () => {
    const frames = await collectEvents('/p/alpha/events', 400, async () => {
      // Someone starts editing in beta. Alpha must not hear about it.
      await api('POST', '/p/beta/presence', JANE, { doc: 'beta.srs.json', itemId: 'r_1' });
    });

    expect(frames.map((f) => f.event)).toEqual(['hello']);
    expect(frames[0].data.projectId).toBe('alpha');
  });

  it("delivers the project's own presence to its subscribers", async () => {
    const frames = await collectEvents('/p/alpha/events', 400, async () => {
      await api('POST', '/p/alpha/presence', RAJ, { doc: 'alpha.srs.json', itemId: 'r_1' });
    });

    const presence = frames.find((f) => f.event === 'presence');
    expect(presence?.data).toEqual([
      expect.objectContaining({ userId: 'raj', doc: 'alpha.srs.json', itemId: 'r_1' }),
    ]);
    await api('POST', '/p/alpha/presence', RAJ, { release: true });
  });
});
