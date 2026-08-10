import { describe, it, expect, afterEach, vi } from 'vitest';
import { RemoteTransport, connectToServer, RemoteError, isProjectChoice, fetchProjects } from '../remote';
import type { ServerSession } from '../remote';

// Behaviour specific to the server transport: optimistic concurrency (CE-1), the
// role-driven read-only flag (EDR-3), refusals that carry data (CMT-4, MRG-6), and a
// probe that must not mistake a static host for a server (EDR-2).

const session = (role: ServerSession['role'] = 'committer'): ServerSession => ({
  principal: { id: 'jane', displayName: 'Jane Smith', email: 'jane@corp.example' },
  role,
  capabilities: {
    read: true,
    write: role !== 'reader',
    commit: role === 'committer',
  },
  repo: { branch: 'main', projectDir: 'docs/specpad' },
  project: 'acme',
  activeJob: null,
  commitPolicy: { requireActiveJob: true, requireGovernanceClean: 'warn' },
});

/** Stub fetch with a queue of responses, recording every request made. */
function stubFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown; contentType?: string }) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const { status, body, contentType = 'application/json' } = handler(url, init);
      return {
        ok: status >= 200 && status < 300,
        status,
        headers: new Headers({ 'content-type': contentType }),
        json: async () => body,
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
      } as unknown as Response;
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('connectToServer (EDR-2)', () => {
  it('returns a transport when a server answers with a session', async () => {
    stubFetch(() => ({ status: 200, body: session() }));

    const transport = await connectToServer('/api/v1');

    expect(transport).toBeInstanceOf(RemoteTransport);
    expect((transport as RemoteTransport).getSession().principal.displayName).toBe('Jane Smith');
    expect((transport as RemoteTransport).projectName()).toBe('acme');
  });

  it('returns null when there is no server', async () => {
    stubFetch(() => ({ status: 404, body: { error: 'nope' } }));

    expect(await connectToServer('/api/v1')).toBeNull();
  });

  it('is not fooled by a static host serving the SPA index for an unknown path', async () => {
    // specpad.com answers /api/v1/session with index.html and a 200.
    stubFetch(() => ({ status: 200, body: '<!doctype html><html></html>', contentType: 'text/html' }));

    expect(await connectToServer('/api/v1')).toBeNull();
  });

  it('returns null when the JSON does not look like a session', async () => {
    stubFetch(() => ({ status: 200, body: { something: 'else' } }));

    expect(await connectToServer('/api/v1')).toBeNull();
  });

  it('returns null when the network call fails outright', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));

    expect(await connectToServer('/api/v1')).toBeNull();
  });
});

describe('reaching a multi-project server (MPT-9)', () => {
  it('addresses the project named in the URL', async () => {
    const calls = stubFetch(() => ({ status: 200, body: session() }));

    await connectToServer('/api/v1/p/acme');

    expect(calls[0].url).toBe('/api/v1/p/acme/session');
  });

  it('returns the project list when the server hosts several and none was named', async () => {
    stubFetch(() => ({
      status: 400,
      body: {
        error: 'This server hosts several projects; name one in the request path.',
        projects: [
          { id: 'acme', title: 'Acme', branch: 'main', role: 'committer' },
          { id: 'beta', title: 'Beta', branch: 'main', role: 'reader' },
        ],
      },
    }));

    const result = await connectToServer('/api/v1');

    // Not null: falling back to the local folder picker would hide a healthy server.
    expect(isProjectChoice(result)).toBe(true);
    expect((result as { chooseProject: { id: string }[] }).chooseProject.map((p) => p.id)).toEqual([
      'acme',
      'beta',
    ]);
  });

  it('treats a refusal carrying no project list as no server at all', async () => {
    stubFetch(() => ({ status: 400, body: { error: 'something else entirely' } }));

    expect(await connectToServer('/api/v1')).toBeNull();
  });
});

describe('role-driven read-only (EDR-3)', () => {
  it('is read-only for a reader', () => {
    expect(new RemoteTransport('/api/v1', session('reader')).readOnly).toBe(true);
  });

  it('is writable for an editor and a committer', () => {
    expect(new RemoteTransport('/api/v1', session('editor')).readOnly).toBe(false);
    expect(new RemoteTransport('/api/v1', session('committer')).readOnly).toBe(false);
  });
});

describe('optimistic concurrency (CE-1)', () => {
  it('replays the version tag it saw on read when writing', async () => {
    const calls = stubFetch((_url, init) => {
      if (init?.method === 'PUT') return { status: 200, body: { version: 'v2' } };
      return { status: 200, body: { doc: { type: 'srs' }, version: 'v1' } };
    });
    const transport = new RemoteTransport('/api/v1', session());

    await transport.readJson(['acme.srs.json']);
    await transport.writeText(['acme.srs.json'], '{"type":"srs"}');

    const put = calls.find((c) => c.init?.method === 'PUT');
    expect(JSON.parse(String(put!.init!.body))).toEqual({ doc: { type: 'srs' }, version: 'v1' });
  });

  it('carries the new version forward after a write', async () => {
    const calls = stubFetch((_url, init) => {
      if (init?.method === 'PUT') return { status: 200, body: { version: 'v2' } };
      return { status: 200, body: { doc: { type: 'srs' }, version: 'v1' } };
    });
    const transport = new RemoteTransport('/api/v1', session());

    await transport.readJson(['acme.srs.json']);
    await transport.writeText(['acme.srs.json'], '{"type":"srs"}');
    await transport.writeText(['acme.srs.json'], '{"type":"srs"}');

    const puts = calls.filter((c) => c.init?.method === 'PUT');
    expect(JSON.parse(String(puts[1].init!.body)).version).toBe('v2');
  });

  it('surfaces a rejected stale write as an error the user can see', async () => {
    stubFetch(() => ({
      status: 409,
      body: { error: 'This document changed since you loaded it. Reload and reapply your edit.' },
    }));
    const transport = new RemoteTransport('/api/v1', session());

    await expect(transport.writeText(['acme.srs.json'], '{}')).rejects.toThrow(
      /changed since you loaded it/,
    );
  });
});

describe('writes route by kind', () => {
  it('sends a document through the document endpoint', async () => {
    const calls = stubFetch(() => ({ status: 200, body: { version: 'v2' } }));

    await new RemoteTransport('/api/v1', session()).writeText(['acme.srs.json'], '{"a":1}');

    expect(calls[0].url).toBe('/api/v1/doc/acme.srs.json');
    expect(JSON.parse(String(calls[0].init!.body)).doc).toEqual({ a: 1 });
  });

  it('sends anything else through the text endpoint, verbatim', async () => {
    const calls = stubFetch(() => ({ status: 200, body: { written: true } }));

    await new RemoteTransport('/api/v1', session()).writeText(['acme.sad.md'], '# Architecture');

    expect(calls[0].url).toBe('/api/v1/text/acme.sad.md');
    expect(JSON.parse(String(calls[0].init!.body))).toEqual({ text: '# Architecture' });
  });

  it('encodes path segments without mangling the separators', async () => {
    const calls = stubFetch(() => ({ status: 200, body: { version: 'v2' } }));

    await new RemoteTransport('/api/v1', session()).writeText(
      ['.specpad', 'run', 'acme run.run.json'],
      '{}',
    );

    expect(calls[0].url).toBe('/api/v1/doc/.specpad/run/acme%20run.run.json');
  });
});

describe('commit (CMT-3)', () => {
  it('returns the commit on success', async () => {
    stubFetch(() => ({ status: 200, body: { ok: true, commit: 'abc123' } }));

    const result = await new RemoteTransport('/api/v1', session()).commit('Clarify REQ-14');

    expect(result).toEqual({ ok: true, commit: 'abc123' });
  });

  it('returns a refusal as data rather than throwing, so the dialog can render it', async () => {
    stubFetch(() => ({
      status: 409,
      body: { ok: false, gate: { ok: false, blocked: ['traceability: r_2 has no verifying test'], warnings: [] } },
    }));

    const result = await new RemoteTransport('/api/v1', session()).commit('x');

    expect(result.ok).toBe(false);
    expect(result.gate?.blocked).toEqual(['traceability: r_2 has no verifying test']);
  });

  it('returns merge conflicts as data (MRG-6)', async () => {
    stubFetch(() => ({
      status: 409,
      body: {
        ok: false,
        conflicts: [{ itemId: 'r_1', kind: 'field', field: 'text', ours: 'mine', theirs: 'theirs' }],
      },
    }));

    const result = await new RemoteTransport('/api/v1', session()).commit('x');

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts![0]).toMatchObject({ itemId: 'r_1', field: 'text' });
  });

  it('throws a RemoteError for a genuine failure', async () => {
    stubFetch(() => ({ status: 500, body: { error: 'the git remote exploded' } }));

    await expect(new RemoteTransport('/api/v1', session()).commit('x')).rejects.toThrow(RemoteError);
    await expect(new RemoteTransport('/api/v1', session()).commit('x')).rejects.toThrow(
      /git remote exploded/,
    );
  });
});

describe('presence (CE-3, CE-4)', () => {
  it('announces where the user is editing', async () => {
    const calls = stubFetch(() => ({ status: 200, body: { presence: [] } }));

    await new RemoteTransport('/api/v1', session()).claimPresence('acme.srs.json', 'r_14');

    expect(calls[0].url).toBe('/api/v1/presence');
    expect(JSON.parse(String(calls[0].init!.body))).toEqual({
      doc: 'acme.srs.json',
      itemId: 'r_14',
    });
  });

  it('releases on request', async () => {
    const calls = stubFetch(() => ({ status: 200, body: { presence: [] } }));

    await new RemoteTransport('/api/v1', session()).releasePresence();

    expect(JSON.parse(String(calls[0].init!.body))).toEqual({ release: true });
  });

  it('swallows a failure, because a courtesy must never break an edit (CE-4)', async () => {
    stubFetch(() => ({ status: 500, body: { error: 'presence exploded' } }));
    const transport = new RemoteTransport('/api/v1', session());

    await expect(transport.claimPresence('acme.srs.json', 'r_14')).resolves.toBeUndefined();
    await expect(transport.releasePresence()).resolves.toBeUndefined();
  });

  it('subscribes to the event stream and routes each event to its handler', () => {
    const listeners = new Map<string, (e: MessageEvent) => void>();
    let closed = false;
    class FakeEventSource {
      constructor(public url: string) {}
      addEventListener(name: string, fn: (e: MessageEvent) => void) {
        listeners.set(name, fn);
      }
      close() {
        closed = true;
      }
    }
    vi.stubGlobal('EventSource', FakeEventSource);

    const seen: Record<string, unknown> = {};
    const off = new RemoteTransport('/api/v1', session()).subscribeEvents({
      onHello: (info) => (seen.hello = info),
      onPresence: (list) => (seen.presence = list),
      onUpstream: (moved) => (seen.upstream = moved),
    });

    listeners.get('hello')!({ data: '{"presence":[],"sha":null,"branch":"main"}' } as MessageEvent);
    listeners.get('presence')!({ data: '[{"userId":"kim","itemId":"r_1"}]' } as MessageEvent);
    listeners.get('upstream')!({ data: '{"sha":"abc","branch":"main"}' } as MessageEvent);

    expect(seen.hello).toMatchObject({ branch: 'main' });
    expect(seen.presence).toEqual([{ userId: 'kim', itemId: 'r_1' }]);
    expect(seen.upstream).toEqual({ sha: 'abc', branch: 'main' });

    off();
    expect(closed).toBe(true);
  });

  it('ignores a malformed frame rather than breaking the editor', () => {
    const listeners = new Map<string, (e: MessageEvent) => void>();
    class FakeEventSource {
      constructor(public url: string) {}
      addEventListener(name: string, fn: (e: MessageEvent) => void) {
        listeners.set(name, fn);
      }
      close() {}
    }
    vi.stubGlobal('EventSource', FakeEventSource);

    let calls = 0;
    new RemoteTransport('/api/v1', session()).subscribeEvents({
      onPresence: () => {
        calls++;
      },
    });

    expect(() => listeners.get('presence')!({ data: 'not json' } as MessageEvent)).not.toThrow();
    expect(calls).toBe(0);
  });

  it('degrades to a no-op where EventSource does not exist', () => {
    vi.stubGlobal('EventSource', undefined);

    const off = new RemoteTransport('/api/v1', session()).subscribeEvents({ onPresence: () => {} });

    expect(() => off()).not.toThrow();
  });
});

describe('discard (CMT-7)', () => {
  it('drops cached version tags, since the working copy was reverted', async () => {
    const calls = stubFetch((url, init) => {
      if (url.endsWith('/discard')) return { status: 200, body: { changed: [], dirty: false } };
      if (init?.method === 'PUT') return { status: 200, body: { version: 'v9' } };
      return { status: 200, body: { doc: { type: 'srs' }, version: 'v1' } };
    });
    const transport = new RemoteTransport('/api/v1', session());

    await transport.readJson(['acme.srs.json']);
    await transport.discard();
    await transport.writeText(['acme.srs.json'], '{"type":"srs"}');

    const put = calls.find((c) => c.init?.method === 'PUT');
    expect(JSON.parse(String(put!.init!.body)).version).toBeUndefined();
  });
});

describe('listing the projects a user may open (MPT-11)', () => {
  it('asks the deployment root, not the project currently open', async () => {
    const calls = stubFetch(() => ({ status: 200, body: { projects: [] } }));

    await fetchProjects();

    expect(calls[0].url).toBe('/api/v1/projects');
  });

  it('returns the listed projects', async () => {
    stubFetch(() => ({
      status: 200,
      body: { projects: [{ id: 'acme', title: 'Acme', branch: 'main', role: 'reader' }] },
    }));

    expect(await fetchProjects()).toEqual([
      { id: 'acme', title: 'Acme', branch: 'main', role: 'reader' },
    ]);
  });

  it('degrades to an empty list rather than throwing — the switcher is not load-bearing', async () => {
    stubFetch(() => ({ status: 500, body: { error: 'boom' } }));
    expect(await fetchProjects()).toEqual([]);

    stubFetch(() => ({ status: 200, body: { something: 'else' } }));
    expect(await fetchProjects()).toEqual([]);
  });
});
