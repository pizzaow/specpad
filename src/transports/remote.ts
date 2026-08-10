/**
 * Remote transport — a SpecPad server (EDR-1, EDR-2).
 *
 * The project lives in a git clone the server owns, not on this machine. Reads and
 * writes become HTTP calls; writes land in *this user's* private working copy and are
 * not committed until they press Commit (CMT-3).
 *
 * Version tags seen on read are replayed on write, so a stale edit is rejected by the
 * server rather than silently overwriting someone (CE-1).
 */
import type { SpecPadDoc } from '../shared';
import type { FileApi, DocumentListItem } from './types';

export interface ServerSession {
  principal: { id: string; displayName: string; email: string };
  role: 'reader' | 'editor' | 'committer';
  capabilities: { read: boolean; write: boolean; commit: boolean };
  repo: { branch: string; projectDir: string };
  /** Which of the server's projects this session is for (MPT-3). */
  projectId?: string;
  project: string;
  activeJob: unknown | null;
  commitPolicy: { requireActiveJob: boolean; requireGovernanceClean: string };
}

/** One changed file, summarized at item level where it is a register (CMT-7). */
export interface PendingChange {
  path: string;
  kind: 'register' | 'file';
  added?: string[];
  modified?: string[];
  removed?: string[];
}

export interface ServerStatus {
  changed: string[];
  dirty: boolean;
  diff?: PendingChange[];
}

/** A conflict the server could not resolve structurally (MRG-6). */
export interface ServerConflict {
  itemId: string | null;
  kind: 'field' | 'delete-modify';
  field?: string;
  base?: unknown;
  ours?: unknown;
  theirs?: unknown;
}

export interface CommitResult {
  ok: boolean;
  commit?: string;
  message?: string;
  conflicts?: ServerConflict[];
  gate?: {
    ok: boolean;
    blocked: string[];
    warnings: string[];
  };
}

/** Someone else, and where they are (CE-3). */
export interface Presence {
  userId: string;
  displayName: string;
  doc: string | null;
  itemId: string | null;
}

export interface UpstreamMoved {
  sha: string;
  branch: string;
}

export interface ServerEventHandlers {
  onHello?(info: { presence: Presence[]; sha: string | null; branch: string }): void;
  onPresence?(present: Presence[]): void;
  onUpstream?(moved: UpstreamMoved): void;
}

export class RemoteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'RemoteError';
  }
}

export class RemoteTransport implements FileApi {
  private readonly base: string;
  private documents: DocumentListItem[] = [];
  /** Last version tag seen per path, replayed on write for optimistic concurrency. */
  private readonly versions = new Map<string, string>();

  constructor(
    baseUrl: string,
    private session: ServerSession,
  ) {
    this.base = baseUrl.replace(/\/+$/, '');
  }

  /** A reader gets a read-only editor; the server enforces it regardless (EDR-3). */
  get readOnly(): boolean {
    return !this.session.capabilities.write;
  }

  get role(): ServerSession['role'] {
    return this.session.role;
  }

  getSession(): ServerSession {
    return this.session;
  }

  projectName(): string {
    return this.session.project;
  }

  isOpen(): boolean {
    return true;
  }

  // ---- FileApi ----

  async listDocuments(): Promise<DocumentListItem[]> {
    const { documents } = await this.request<{ documents: DocumentListItem[] }>('GET', '/documents');
    this.documents = documents;
    return documents;
  }

  async readJson(path: string[]): Promise<SpecPadDoc | null> {
    const key = path.join('/');
    const result = await this.request<{ doc: SpecPadDoc; version: string }>(
      'GET',
      `/doc/${encodePath(key)}`,
      undefined,
      { absent: [404] },
    );
    if (!result) return null;
    this.versions.set(key, result.version);
    return result.doc;
  }

  async readText(path: string[]): Promise<string | null> {
    // 400 counts as absent too: a path the server rejects is unresolvable, and one bad
    // diagram reference must never abort opening the project (DGM-4).
    const result = await this.request<{ text: string }>(
      'GET',
      `/text/${encodePath(path.join('/'))}`,
      undefined,
      { absent: [404, 400] },
    );
    return result ? result.text : null;
  }

  async writeText(path: string[], content: string): Promise<void> {
    const key = path.join('/');
    // A SpecPad document goes through the document endpoint so the server can apply
    // optimistic concurrency; anything else (the SAD, a diagram) is written as text.
    if (key.endsWith('.json')) {
      const result = await this.request<{ version: string }>('PUT', `/doc/${encodePath(key)}`, {
        doc: JSON.parse(content),
        version: this.versions.get(key),
      });
      this.versions.set(key, result.version);
      return;
    }
    await this.request('PUT', `/text/${encodePath(key)}`, { text: content });
  }

  // ---- Server-only operations ----

  async refreshSession(): Promise<ServerSession> {
    this.session = await this.request<ServerSession>('GET', '/session');
    return this.session;
  }

  async status(): Promise<ServerStatus> {
    return this.request<ServerStatus>('GET', '/status');
  }

  /** Publish this user's pending changes as one commit (CMT-3). */
  async commit(message: string): Promise<CommitResult> {
    const result = await this.request<CommitResult>('POST', '/commit', { message }, { soft: [409] });
    // A refused commit is a 409 carrying the gate result or the conflicts — data, not
    // an error: the dialog renders it so the user can act on it.
    return result ?? { ok: false, message: 'The commit was refused.' };
  }

  async discard(): Promise<ServerStatus> {
    this.versions.clear();
    return this.request<ServerStatus>('POST', '/discard');
  }

  // ---- Presence (CE-3, CE-4) — advisory, and never allowed to affect an edit ----

  /**
   * Announce where this user is. Failures are swallowed deliberately: presence is a
   * courtesy, and a courtesy that can break someone's editing session is a defect.
   */
  async claimPresence(doc: string | null, itemId: string | null): Promise<void> {
    try {
      await this.request('POST', '/presence', { doc, itemId });
    } catch {
      /* advisory only */
    }
  }

  async releasePresence(): Promise<void> {
    try {
      await this.request('POST', '/presence', { release: true });
    } catch {
      /* advisory only */
    }
  }

  /**
   * Subscribe to the server's event stream. Returns an unsubscribe function.
   *
   * Degrades to a no-op where `EventSource` does not exist, so an environment without
   * SSE gets an editor that simply says less rather than one that breaks.
   */
  subscribeEvents(handlers: ServerEventHandlers): () => void {
    const Source = (globalThis as { EventSource?: typeof EventSource }).EventSource;
    if (!Source) return () => {};

    const source = new Source(`${this.base}/events`);
    const listen = (name: string, handle: ((data: any) => void) | undefined) => {
      if (!handle) return;
      source.addEventListener(name, (event) => {
        try {
          handle(JSON.parse((event as MessageEvent).data));
        } catch {
          /* a malformed frame is not worth breaking the editor over */
        }
      });
    };

    listen('hello', handlers.onHello);
    listen('presence', handlers.onPresence);
    listen('upstream', handlers.onUpstream);

    return () => source.close();
  }

  // ---- Internals ----

  /**
   * `absent` statuses resolve to null — the file is not there, which is not an error.
   * `soft` statuses resolve to their payload, for responses that are *refusals carrying
   * data* (a 409 commit result the dialog has to render). Everything else throws.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    handled: { absent?: number[]; soft?: number[] } = {},
  ): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const payload = await res.json().catch(() => null);
    if (res.ok) return payload as T;
    if (handled.absent?.includes(res.status)) return null as T;
    if (handled.soft?.includes(res.status)) return payload as T;

    const message =
      (payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : null) ?? `Request failed (HTTP ${res.status})`;
    throw new RemoteError(message, res.status);
  }

  /** Documents from the last listing, for callers that cannot await. */
  get cachedDocuments(): DocumentListItem[] {
    return this.documents;
  }
}

/** Encode a path for a URL without turning its separators into %2F. */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

/** One project this user may open, as the server's discovery reply describes it (MPT-7). */
export interface ProjectSummary {
  id: string;
  title: string;
  branch: string;
  role: string;
}

/**
 * A server that hosts several projects, reached without naming one (MPT-3). This is a
 * question to put to the user, not a failure: falling back to local-file mode here
 * would hide a perfectly healthy server behind a folder picker.
 */
export interface ProjectChoice {
  chooseProject: ProjectSummary[];
}

export function isProjectChoice(result: unknown): result is ProjectChoice {
  return typeof result === 'object' && result !== null && 'chooseProject' in result;
}

/**
 * Probe for a SpecPad server at `baseUrl`. Returns null when there is none — a static
 * host answering the SPA's index.html for an unknown path must not be mistaken for one,
 * so the response has to be JSON *and* carry a session shape.
 *
 * A 400 carrying a project list is a server saying "which one?" and is returned as such.
 */
export async function connectToServer(
  baseUrl: string,
): Promise<RemoteTransport | ProjectChoice | null> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/session`, {
      credentials: 'same-origin',
    });
    if (!(res.headers.get('content-type') ?? '').includes('application/json')) return null;
    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      // Only a project list makes a refusal meaningful; anything else is "no server".
      const projects = (payload as { projects?: ProjectSummary[] } | null)?.projects;
      return Array.isArray(projects) && projects.length > 0 ? { chooseProject: projects } : null;
    }

    const session = payload as ServerSession;
    if (!session || typeof session !== 'object' || !session.principal || !session.role) return null;
    return new RemoteTransport(baseUrl, session);
  } catch {
    return null;
  }
}
