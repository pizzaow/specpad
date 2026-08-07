/**
 * The HTTP API (SRV-4). Every endpoint mirrors a capability the editor already had
 * against local files, which is what keeps the transport seam honest.
 *
 * Authorization is enforced here, not in the browser: the editor's read-only rendering
 * is a courtesy, and a reader's write request is refused server-side regardless of what
 * the client chose to display (EDR-3).
 */
import { can } from './auth';
import type { Session } from './auth';
import type { ServerConfig } from './config';
import type { WorkingCopy } from './workingCopy';
import { PathError } from './paths';

export interface ApiRequest {
  method: string;
  /** Path after the /api/v1 prefix, e.g. "/doc/acme.srs.json". */
  path: string;
  query: URLSearchParams;
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

const ok = (body: unknown): ApiResponse => ({ status: 200, body });
const error = (status: number, message: string, extra: Record<string, unknown> = {}): ApiResponse => ({
  status,
  body: { error: message, ...extra },
});

export async function handleApi(
  req: ApiRequest,
  session: Session,
  workingCopy: WorkingCopy,
  config: ServerConfig,
): Promise<ApiResponse> {
  try {
    return await route(req, session, workingCopy, config);
  } catch (err) {
    if (err instanceof PathError) return error(400, err.message);
    return error(500, err instanceof Error ? err.message : String(err));
  }
}

async function route(
  req: ApiRequest,
  session: Session,
  wc: WorkingCopy,
  config: ServerConfig,
): Promise<ApiResponse> {
  const { method, path } = req;

  // ---- Session ----
  if (method === 'GET' && path === '/session') {
    const bundle = await wc.bundle();
    return ok({
      principal: {
        id: session.principal.id,
        displayName: session.principal.displayName,
        email: session.principal.email,
      },
      role: session.role,
      capabilities: {
        read: can(session.role, 'read'),
        write: can(session.role, 'write'),
        commit: can(session.role, 'commit'),
      },
      repo: { branch: config.repo.branch, projectDir: config.repo.paths[0] },
      project: await wc.projectName(),
      activeJob: bundle.job ?? null,
      commitPolicy: config.commit,
    });
  }

  if (!can(session.role, 'read')) return error(403, 'You do not have access to this project.');

  // ---- Reads ----
  if (method === 'GET' && path === '/documents') {
    return ok({ documents: await wc.listDocuments() });
  }

  if (method === 'GET' && path === '/status') {
    const status = await wc.status();
    return ok({ ...status, diff: status.dirty ? await wc.pendingDiff() : [] });
  }

  if (method === 'GET' && path.startsWith('/doc/')) {
    const doc = await wc.readJson(decodeURIComponent(path.slice('/doc/'.length)));
    if (doc === null) return error(404, 'Document not found.');
    return ok({ doc, version: versionTag(doc) });
  }

  if (method === 'GET' && path.startsWith('/text/')) {
    const text = await wc.readText(decodeURIComponent(path.slice('/text/'.length)));
    if (text === null) return error(404, 'File not found.');
    return ok({ text });
  }

  // ---- Writes ----
  const isWrite = method === 'PUT' || method === 'POST';
  if (isWrite && !can(session.role, 'write')) {
    return error(403, 'Your role does not permit editing this project.');
  }

  if (method === 'PUT' && path.startsWith('/doc/')) {
    const clientPath = decodeURIComponent(path.slice('/doc/'.length));
    const body = req.body as { doc?: unknown; version?: string } | undefined;
    if (!body || typeof body.doc !== 'object' || body.doc === null) {
      return error(400, 'Expected a JSON body of the form { doc, version }.');
    }
    // Optimistic concurrency: reject a write built on a version we have moved past (CE-1).
    const current = await wc.readJson(clientPath);
    if (current && body.version && versionTag(current) !== body.version) {
      return error(409, 'This document changed since you loaded it. Reload and reapply your edit.', {
        version: versionTag(current),
      });
    }
    await wc.writeText(clientPath, `${JSON.stringify(body.doc, null, 2)}\n`);
    return ok({ version: versionTag(body.doc) });
  }

  if (method === 'PUT' && path.startsWith('/text/')) {
    const body = req.body as { text?: unknown } | undefined;
    if (!body || typeof body.text !== 'string') {
      return error(400, 'Expected a JSON body of the form { text }.');
    }
    await wc.writeText(decodeURIComponent(path.slice('/text/'.length)), body.text);
    return ok({ written: true });
  }

  if (method === 'POST' && path === '/commit') {
    if (!can(session.role, 'commit')) {
      return error(403, 'Your role does not permit committing.');
    }
    const body = req.body as { message?: string } | undefined;
    const message = (body?.message ?? '').trim();
    if (!message) return error(400, 'A commit message is required.');

    const outcome = await wc.publish(session.principal, message);
    return outcome.ok ? ok(outcome) : { status: 409, body: outcome };
  }

  if (method === 'POST' && path === '/discard') {
    await wc.discard();
    return ok(await wc.status());
  }

  return error(404, `No such endpoint: ${method} ${path}`);
}

/**
 * A cheap content version tag for optimistic concurrency (CE-1). Content-derived rather
 * than a counter, so it survives a server restart and cannot drift from the file.
 */
export function versionTag(doc: unknown): string {
  const text = JSON.stringify(doc);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
