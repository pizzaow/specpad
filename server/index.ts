/**
 * Entry point (SRV-1): one process serving the version-pinned editor build and the API
 * from a single origin. Same origin means no CORS, no third-party cookies, no
 * cross-domain OAuth redirects, and no dependency on specpad.com being reachable from
 * inside a corporate network.
 *
 *   node --experimental-strip-types server/index.ts ./specpad-server.config.json
 */
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadConfig, isLoopbackBind, SCHEMA_VERSION_PATH } from './config';
import type { ServerConfig } from './config';
import { createAuthProvider, resolveSession } from './auth';
import { Repository } from './repository';
import { handleApi } from './api';

const API_PREFIX = '/api/v1';
const MAX_BODY_BYTES = 8 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body is too large.');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** Serve the editor build, confined to `editorDir`. */
async function serveStatic(
  res: http.ServerResponse,
  editorDir: string,
  urlPath: string,
): Promise<void> {
  const relative = urlPath.replace(/^\/+/, '');
  const resolved = path.resolve(editorDir, relative);
  // Never serve outside the build directory, whatever the URL contained.
  if (resolved !== editorDir && !resolved.startsWith(editorDir + path.sep)) {
    sendJson(res, 400, { error: 'Invalid path.' });
    return;
  }

  let file = resolved;
  const stat = await fs.stat(file).catch(() => null);
  if (!stat || stat.isDirectory()) file = path.join(resolved, 'index.html');

  const data = await fs.readFile(file).catch(() => null);
  if (!data) {
    // The editor is a single-page app: unknown paths fall back to its index.
    const index = await fs.readFile(path.join(editorDir, 'index.html')).catch(() => null);
    if (!index) {
      sendJson(res, 404, { error: 'Not found.' });
      return;
    }
    res.writeHead(200, { 'content-type': CONTENT_TYPES['.html'] });
    res.end(index);
    return;
  }

  res.writeHead(200, {
    'content-type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
  });
  res.end(data);
}

export function createServer(config: ServerConfig, repository: Repository, editorDir: string) {
  const provider = createAuthProvider(config.auth);

  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    try {
      if (!url.pathname.startsWith(API_PREFIX)) {
        const editorPath = url.pathname.startsWith(SCHEMA_VERSION_PATH)
          ? url.pathname.slice(SCHEMA_VERSION_PATH.length)
          : url.pathname;
        await serveStatic(res, editorDir, editorPath);
        return;
      }

      const session = await resolveSession(provider, config.auth, {
        headers: req.headers as Record<string, string | string[] | undefined>,
        remoteAddress: req.socket.remoteAddress,
      });
      if (!session) {
        sendJson(res, 401, { error: 'You are not signed in, or have no access to this project.' });
        return;
      }

      const workingCopy = await repository.workingCopyFor(session.principal);
      const response = await handleApi(
        {
          method: req.method ?? 'GET',
          path: url.pathname.slice(API_PREFIX.length) || '/',
          query: url.searchParams,
          body: await readBody(req),
        },
        session,
        workingCopy,
        config,
      );
      sendJson(res, response.status, response.body);
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });
}

export async function main(argv: string[]): Promise<void> {
  const configPath = argv[2];
  if (!configPath) {
    throw new Error('Usage: specpad-server <config.json>');
  }
  const config = loadConfig(JSON.parse(await fs.readFile(configPath, 'utf8')));
  const editorDir = path.resolve(process.env.SPECPAD_EDITOR_DIR ?? 'dist');

  const repository = new Repository(config);
  await repository.ensureClone();

  const server = createServer(config, repository, editorDir);
  server.listen(config.port, config.bind, () => {
    const where = isLoopbackBind(config.bind) ? 'localhost only' : config.bind;
    // eslint-disable-next-line no-console
    console.log(
      `SpecPad server listening on ${where}:${config.port} — ` +
        `${config.repo.url} (${config.repo.branch}), auth: ${config.auth.provider}`,
    );
  });
}
