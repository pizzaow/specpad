/**
 * Path confinement (SRV-2).
 *
 * The server holds push access to a real repository, so a path-handling mistake is a
 * security bug, not a tidiness one. Two independent defences:
 *
 *   1. Sparse-checkout means the working tree physically cannot contain anything
 *      outside the allowlist (see workingCopy.ts).
 *   2. This module, which refuses any client path that escapes the project root, and
 *      re-checks the staged diff before a commit is made.
 *
 * Client paths are always relative to the project root (the first allowlisted path).
 * There is deliberately no way to express an absolute path or a parent traversal.
 */

export class PathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathError';
  }
}

/** Split a client path into segments, rejecting anything that could escape the root. */
function safeSegments(path: string[] | string): string[] {
  const raw = (Array.isArray(path) ? path : [path]).map((p) => String(p));
  const parts = raw.flatMap((p) => p.split(/[\\/]/)).filter((s) => s !== '' && s !== '.');

  if (parts.length === 0) throw new PathError('Path is empty');

  // An absolute path is refused outright rather than quietly reinterpreted as relative:
  // a client asking for "/etc/passwd" has a bug, and silently serving
  // "docs/specpad/etc/passwd" would hide it.
  if (raw.some((p) => /^[\\/]/.test(p))) {
    throw new PathError(`Absolute paths are not permitted: ${describe(path)}`);
  }

  for (const segment of parts) {
    if (segment === '..') throw new PathError(`Path escapes the project root: ${describe(path)}`);
    if (segment.includes('\0')) throw new PathError('Path contains a null byte');
    if (/^[A-Za-z]:$/.test(segment)) {
      throw new PathError(`Absolute paths are not permitted: ${describe(path)}`);
    }
  }
  return parts;
}

function describe(path: string[] | string): string {
  return Array.isArray(path) ? path.join('/') : path;
}

/**
 * Resolve a client path to a repository-relative path underneath `root`.
 * Throws `PathError` for anything that escapes, is absolute, or is empty.
 */
export function resolveInProject(root: string, path: string[] | string): string {
  const base = normalizeRoot(root);
  const resolved = `${base}/${safeSegments(path).join('/')}`;
  // Belt and braces: whatever the segment rules did, the answer must still be inside.
  if (!isWithin(base, resolved)) {
    throw new PathError(`Path escapes the project root: ${describe(path)}`);
  }
  return resolved;
}

/** Strip trailing slashes and normalize separators, so prefixes compare cleanly. */
export function normalizeRoot(root: string): string {
  return root.replace(/\\/g, '/').replace(/\/+$/, '');
}

/** Is `candidate` the directory `root` itself, or something inside it? */
export function isWithin(root: string, candidate: string): boolean {
  const base = normalizeRoot(root);
  const path = candidate.replace(/\\/g, '/');
  return path === base || path.startsWith(`${base}/`);
}

/**
 * Does this repository-relative path fall inside any allowlisted path? Used to verify
 * a staged diff before committing — the last check before the server touches the repo.
 */
export function isAllowlisted(allowlist: string[], repoPath: string): boolean {
  return allowlist.some((root) => isWithin(root, repoPath));
}

/**
 * Every staged path that falls outside the allowlist. A non-empty result must abort
 * the commit: the working tree should have made it impossible, so something is wrong.
 */
export function offendingPaths(allowlist: string[], stagedPaths: string[]): string[] {
  return stagedPaths.filter((p) => !isAllowlisted(allowlist, p));
}
