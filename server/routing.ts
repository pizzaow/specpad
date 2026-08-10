/**
 * Request routing across projects (MPT-3).
 *
 * A path under the API prefix either names a project explicitly (`/p/<id>/…`) or names
 * none. Naming none is only answerable when the deployment has exactly one project; on
 * a multi-project server it is a question, not a default, so resolution fails rather
 * than picking an arbitrary project for someone.
 *
 * Kept as a pure function over strings so the routing rule can be tested without a
 * server, a clone, or a request.
 */

export interface RoutedPath {
  /** The project named in the path, or null when the path named none. */
  projectId: string | null;
  /** The remainder, as the single-project API has always expressed it. */
  path: string;
}

/** The project-scoped prefix, e.g. `/p/acme/doc/acme.srs.json` → `acme` + `/doc/…`. */
export function parseApiPath(path: string): RoutedPath {
  const match = /^\/p\/([^/]+)(\/.*)?$/.exec(path);
  if (!match) return { projectId: null, path };
  return { projectId: decodeURIComponent(match[1]), path: match[2] || '/' };
}

/** The API path addressing `path` within `projectId` — the inverse of the above. */
export function projectApiPath(projectId: string, path = '/'): string {
  return `/p/${encodeURIComponent(projectId)}${path}`;
}
