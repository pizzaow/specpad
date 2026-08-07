// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { start } from '../index';
import { Git, execGitRunner } from '../git';
import type { SrsDoc } from '../../src/shared';

/**
 * Boot the actual process and drive it over HTTP (SRV-1, SRV-4).
 *
 * Every other test imports a module. This one starts the server the way an operator
 * does — from a config file — and goes all the way from an HTTP request to a commit on
 * a branch. It exists because module-level tests all passed while the entry point
 * defined `main()` and never called it: the server could not start at all, and nothing
 * noticed.
 */

function sh(cmd: string, args: string[], cwd: string): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd }, (error, stdout) =>
      resolve({ code: error ? 1 : 0, stdout: stdout ?? '' }),
    );
  });
}

const gitAvailable = (await sh('git', ['--version'], os.tmpdir())).code === 0;

const srs: SrsDoc = {
  schemaVersion: '1.0',
  type: 'srs',
  name: 'acme',
  title: 'Requirements',
  items: [{ id: 'r_1', code: 'REQ-1', text: 'The system shall store records.' }],
};

const json = (doc: unknown) => JSON.stringify(doc, null, 2) + '\n';

let root = '';
let originDir = '';
let server: Server | null = null;
let shutdown: (() => Promise<void>) | null = null;
let base = '';

/** An unprivileged, almost-certainly-free port; the listen would fail loudly if not. */
const PORT = 8749;

async function api(
  method: string,
  route: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${base}${route}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

beforeAll(async () => {
  if (!gitAvailable) return;

  root = await fs.mkdtemp(path.join(os.tmpdir(), 'specpad-boot-'));
  originDir = path.join(root, 'origin.git');
  await sh('git', ['init', '--bare', '-b', 'main', originDir], root);

  const seed = path.join(root, 'seed');
  await sh('git', ['clone', originDir, seed], root);
  await sh('git', ['config', 'user.name', 'Seed'], seed);
  await sh('git', ['config', 'user.email', 'seed@example.com'], seed);
  const spec = path.join(seed, 'docs', 'specpad');
  await fs.mkdir(spec, { recursive: true });
  await fs.writeFile(path.join(spec, 'acme.srs.json'), json(srs));
  await fs.writeFile(
    path.join(spec, 'acme.vtp.json'),
    json({
      schemaVersion: '1.0',
      type: 'vtp',
      name: 'acme',
      title: 'Tests',
      items: [{ id: 't_1', text: 'Confirm.', verifies: ['r_1'], expected: 'Stored.' }],
    }),
  );
  await fs.writeFile(
    path.join(spec, 'acme.proj.json'),
    json({ schemaVersion: '1.0', type: 'project', name: 'acme', title: 'Acme', documents: [] }),
  );
  await sh('git', ['add', '-A'], seed);
  await sh('git', ['commit', '-m', 'Seed'], seed);
  await sh('git', ['push', 'origin', 'main'], seed);

  // A minimal editor build for the static half.
  const editorDir = path.join(root, 'dist');
  await fs.mkdir(editorDir, { recursive: true });
  await fs.writeFile(path.join(editorDir, 'index.html'), '<!doctype html><title>SpecPad</title>');
  process.env.SPECPAD_EDITOR_DIR = editorDir;

  const configPath = path.join(root, 'config.json');
  await fs.writeFile(
    configPath,
    JSON.stringify({
      repo: { url: originDir, branch: 'main', paths: ['docs/specpad'] },
      auth: { provider: 'dev', roles: {} },
      commit: { requireActiveJob: false, requireGovernanceClean: 'block', pushRetries: 3 },
      workDir: path.join(root, 'srv'),
      port: PORT,
      bind: '127.0.0.1',
    }),
  );

  const running = await start(configPath);
  server = running.server;
  shutdown = running.shutdown;
  base = `http://127.0.0.1:${PORT}/api/v1`;
}, 60_000);

afterAll(async () => {
  // Must not hang: open SSE streams never end on their own (CE-3).
  if (shutdown) await shutdown();
  delete process.env.SPECPAD_EDITOR_DIR;
  if (root) await fs.rm(root, { recursive: true, force: true }).catch(() => undefined);
}, 20_000);

describe.skipIf(!gitAvailable)('the server process (SRV-1)', () => {
  it('starts from a config file and listens', () => {
    expect(server?.listening).toBe(true);
  });

  it('serves the editor build from the same origin as the API', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/v01/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('SpecPad');
  });

  it('falls back to the editor index for a client-side route', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/v01/anything`);

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('SpecPad');
  });
});

describe.skipIf(!gitAvailable)('the API over HTTP (SRV-4)', () => {
  it('answers the session probe the editor uses to find a server', async () => {
    const { status, body } = await api('GET', '/session');

    expect(status).toBe(200);
    expect(body.principal.email).toBe('dev@localhost');
    expect(body.role).toBe('committer');
    expect(body.repo).toEqual({ branch: 'main', projectDir: 'docs/specpad' });
    expect(body.project).toBe('acme');
  });

  it('sends JSON, so the editor probe can tell a server from a static host', async () => {
    const res = await fetch(`${base}/session`);

    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('lists the project documents', async () => {
    const { body } = await api('GET', '/documents');

    expect(body.documents.map((d: any) => d.filename).sort()).toEqual([
      'acme.proj.json',
      'acme.srs.json',
      'acme.vtp.json',
    ]);
  });

  it('reads a document with a version tag', async () => {
    const { status, body } = await api('GET', '/doc/acme.srs.json');

    expect(status).toBe(200);
    expect(body.doc).toEqual(srs);
    expect(body.version).toMatch(/^[0-9a-f]{8}$/);
  });

  it('404s a document that is not there', async () => {
    expect((await api('GET', '/doc/acme.prd.json')).status).toBe(404);
  });

  it('refuses a path that escapes the project root (SRV-2)', async () => {
    const { status, body } = await api('GET', '/doc/..%2F..%2Fsrc%2Findex.ts');

    expect(status).toBe(400);
    expect(body.error).toMatch(/escapes the project root|not permitted/i);
  });

  it('404s an unknown endpoint', async () => {
    expect((await api('GET', '/nope')).status).toBe(404);
  });
});

/** Subscribe to the SSE stream and collect framed events until closed. */
function subscribeSse(url: string) {
  const controller = new AbortController();
  const received: { event: string; data: any }[] = [];

  const opened = fetch(url, { signal: controller.signal }).then((res) => {
    void (async () => {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let split: number;
          while ((split = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, split);
            buffer = buffer.slice(split + 2);
            const name = frame.split('\n').find((l) => l.startsWith('event: '));
            if (!name) continue; // a heartbeat comment
            const data = frame
              .split('\n')
              .filter((l) => l.startsWith('data: '))
              .map((l) => l.slice(6))
              .join('\n');
            received.push({ event: name.slice(7), data: data ? JSON.parse(data) : null });
          }
        }
      } catch {
        /* aborted */
      }
    })();
    return res;
  });

  const waitFor = async (event: string, timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = received.find((e) => e.event === event);
      if (found) return found;
      if (Date.now() > deadline) throw new Error(`no "${event}" event within ${timeoutMs}ms`);
      await new Promise((r) => setTimeout(r, 25));
    }
  };

  return { received, opened, waitFor, close: () => controller.abort() };
}

describe.skipIf(!gitAvailable)('the event stream (CE-3, CE-4)', () => {
  it('opens an SSE stream and greets the subscriber with the current state', async () => {
    const stream = subscribeSse(`${base}/events`);
    const res = await stream.opened;

    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    const hello = await stream.waitFor('hello');
    expect(hello.data).toMatchObject({ branch: 'main' });
    expect(hello.data.presence).toEqual([]);

    stream.close();
  }, 20_000);

  it('broadcasts a presence claim naming the item being edited', async () => {
    const stream = subscribeSse(`${base}/events`);
    await stream.waitFor('hello');

    await api('POST', '/presence', { doc: 'acme.srs.json', itemId: 'r_1' });

    const presence = await stream.waitFor('presence');
    expect(presence.data).toEqual([
      {
        userId: 'dev',
        displayName: 'Development User',
        doc: 'acme.srs.json',
        itemId: 'r_1',
      },
    ]);

    stream.close();
  }, 20_000);

  it('leaves the caller out of their own list, and releases on request', async () => {
    // A claim identical to the one already held is deliberately not re-broadcast, so
    // this moves to a different item to produce a fresh event.
    const stream = subscribeSse(`${base}/events`);
    await stream.waitFor('hello');

    const { body } = await api('POST', '/presence', { doc: 'acme.srs.json', itemId: 'r_2' });
    // The caller never needs telling where they themselves are.
    expect(body.presence).toEqual([]);

    const moved = await stream.waitFor('presence');
    expect(moved.data[0]).toMatchObject({ itemId: 'r_2' });

    const release = await api('POST', '/presence', { release: true });
    expect(release.status).toBe(200);
    expect(release.body.presence).toEqual([]);

    stream.close();
  }, 20_000);

  it('drops the subscriber when the client goes away', async () => {
    const stream = subscribeSse(`${base}/events`);
    await stream.waitFor('hello');
    stream.close();

    // A broadcast after the client vanished must not disturb the server.
    await new Promise((r) => setTimeout(r, 100));
    const after = await api('POST', '/presence', { itemId: 'r_1' });
    expect(after.status).toBe(200);
  }, 20_000);
});

describe.skipIf(!gitAvailable)('request to commit, over HTTP (CMT-2, CMT-3)', () => {
  it('writes to the working copy, reports it pending, then publishes it to the branch', async () => {
    const { body: read } = await api('GET', '/doc/acme.srs.json');

    // 1. Write — lands in this user's working copy, uncommitted.
    const edited = {
      ...srs,
      items: [{ ...srs.items[0], text: 'The system shall store records durably.' }],
    };
    const write = await api('PUT', '/doc/acme.srs.json', { doc: edited, version: read.version });
    expect(write.status).toBe(200);

    // 2. Status — pending, summarized at item level.
    const { body: status } = await api('GET', '/status');
    expect(status.dirty).toBe(true);
    expect(status.diff).toEqual([
      {
        path: 'docs/specpad/acme.srs.json',
        kind: 'register',
        added: [],
        modified: ['REQ-1'],
        removed: [],
      },
    ]);

    // Nothing has reached the repository yet.
    const branchGit = new Git(execGitRunner(), originDir);
    expect(await branchGit.showFile('main', 'docs/specpad/acme.srs.json')).toContain(
      'The system shall store records.',
    );

    // 3. Commit.
    const commit = await api('POST', '/commit', { message: 'Clarify durability' });
    expect(commit.status).toBe(200);
    expect(commit.body.ok).toBe(true);

    // 4. It is on the branch, authored by the signed-in user.
    const onBranch = JSON.parse((await branchGit.showFile('main', 'docs/specpad/acme.srs.json'))!);
    expect(onBranch.items[0].text).toBe('The system shall store records durably.');
    const { stdout: log } = await sh('git', ['log', '--format=%an <%ae>%n%s', 'main'], originDir);
    expect(log).toContain('Development User <dev@localhost>');
    expect(log).toContain('Clarify durability');

    // 5. Nothing left pending.
    expect((await api('GET', '/status')).body.dirty).toBe(false);
  }, 30_000);

  it('rejects a write carrying a stale version tag (CE-1)', async () => {
    const { status, body } = await api('PUT', '/doc/acme.srs.json', {
      doc: srs,
      version: 'deadbeef',
    });

    expect(status).toBe(409);
    expect(body.error).toMatch(/changed since you loaded it/i);
  });

  it('refuses a commit that breaks governance, and pushes nothing (CMT-4)', async () => {
    const { body: read } = await api('GET', '/doc/acme.srs.json');
    await api('PUT', '/doc/acme.srs.json', {
      doc: { ...read.doc, items: [...read.doc.items, { id: 'r_9', code: 'REQ-9', text: 'Unverified.' }] },
      version: read.version,
    });

    const commit = await api('POST', '/commit', { message: 'Add an unverified requirement' });

    expect(commit.status).toBe(409);
    expect(commit.body.gate.blocked.join('\n')).toMatch(/traceability/);

    const { stdout: log } = await sh('git', ['log', '--format=%s', 'main'], originDir);
    expect(log).not.toContain('Add an unverified requirement');

    await api('POST', '/discard');
  }, 30_000);

  it('discards pending changes on request (CMT-7)', async () => {
    const { body: read } = await api('GET', '/doc/acme.srs.json');
    await api('PUT', '/doc/acme.srs.json', {
      doc: { ...read.doc, title: 'Scratch' },
      version: read.version,
    });
    expect((await api('GET', '/status')).body.dirty).toBe(true);

    const { status, body } = await api('POST', '/discard');

    expect(status).toBe(200);
    expect(body.dirty).toBe(false);
    expect((await api('GET', '/doc/acme.srs.json')).body.doc.title).toBe('Requirements');
  });

  it('requires a commit message', async () => {
    expect((await api('POST', '/commit', { message: '   ' })).status).toBe(400);
  });
});
