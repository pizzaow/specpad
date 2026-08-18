/**
 * Server configuration (SRV-6, MPT-1, MPT-2).
 *
 * One declarative file describes the whole deployment: which repositories, which
 * branches, which credentials, which authentication provider, who gets which role, and
 * how strict the commit gate is. Validation is exhaustive and startup-blocking — a
 * server that comes up half-configured is worse than one that refuses to come up,
 * because it holds push access to real repositories.
 *
 * A deployment is a list of *projects* (MPT-1): a company with SpecPad in six
 * repositories runs one server, not six. The older single-repository shape (`repo: {…}`
 * at the root) is still accepted and read as a one-project deployment (MPT-2), so an
 * existing config keeps working untouched.
 */

import { editorVersionPath } from '../src/shared';

/**
 * The editor build path this server serves — one definition, shared with the launcher:
 * schemaVersion "1.0" → /v01/. Old version paths stay live forever, so documents always
 * open in an editor that understands them.
 */
export const SCHEMA_VERSION_PATH = editorVersionPath().replace(/\/$/, '');

// `oidc` was listed here while the provider was a stub that threw at first sign-in: a
// deployment could pass config validation with a complete OIDC block and only discover the
// gap when someone tried to log in. Corporate SSO is reached through `proxy` behind the
// company's existing gateway, which covers OIDC, SAML and mTLS alike.
export type AuthProviderName = 'proxy' | 'dev';
export type Role = 'reader' | 'editor' | 'committer';
export type GovernancePolicy = 'block' | 'warn' | 'off';

export const ROLES: Role[] = ['reader', 'editor', 'committer'];

export interface RepoConfig {
  url: string;
  branch: string;
  /** Path to a file holding the git credential (deploy key / token). */
  credentialFile?: string;
  /** Allowlisted paths, relative to the repo root. Also the sparse-checkout cone. */
  paths: string[];
}

/**
 * One project the server hosts (MPT-1): a repository, plus the authorization and commit
 * policy that apply to it. Roles and commit policy are *resolved* here — a project that
 * declares neither inherits the server-wide ones (MPT-5), so the common case of "same
 * rules everywhere" stays a single declaration.
 *
 * Everything below the routing layer takes a `ProjectConfig` rather than the whole
 * server config, which is what makes cross-project access a type error rather than a
 * thing to remember.
 */
export interface ProjectConfig {
  /** URL- and path-safe identifier, unique across the deployment. */
  id: string;
  /** Human label for the project list; defaults to the id. */
  title: string;
  repo: RepoConfig;
  roles: Record<Role, string[]>;
  commit: CommitConfig;
}

/**
 * A project id appears in a URL path and in a directory name, so it is constrained to
 * an obviously safe alphabet rather than escaped at each use.
 */
const PROJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface AuthConfig {
  provider: AuthProviderName;
  /** Peers permitted to assert identity headers (proxy provider only). */
  trustedPeers: string[];
  /** Header names the proxy provider reads. */
  headers: { user: string; email: string; name: string; groups: string };
  /** Group claims that grant each role. */
  roles: Record<Role, string[]>;
  /** Identity used by the dev provider. */
  devUser?: { id: string; displayName: string; email: string; groups: string[] };
}

export interface CommitConfig {
  requireActiveJob: boolean;
  requireGovernanceClean: GovernancePolicy;
  /** Bounded retries when a push is rejected as non-fast-forward (CMT-6). */
  pushRetries: number;
}

/**
 * When to clean up a user's working copy (WCL-1, WCL-4).
 *
 * A checkout per user per project accumulates: six projects and forty staff is 240
 * sparse worktrees that nothing ever removes. Reaping is bounded by one hard rule —
 * a copy holding uncommitted work is never touched (WCL-2) — so the cost of reaping
 * too eagerly is a re-clone, not lost work.
 */
export interface WorkingCopyConfig {
  /** Seconds a working copy may sit unused before it is eligible. 0 disables reaping. */
  idleTimeout: number;
  /** Seconds between sweeps. */
  sweepInterval: number;
}

export interface ServerConfig {
  /** Every project this server hosts, in configuration order (MPT-1). */
  projects: ProjectConfig[];
  workingCopies: WorkingCopyConfig;
  auth: AuthConfig;
  /** Server-wide default, inherited by a project that declares no policy of its own. */
  commit: CommitConfig;
  /** Where each project's bare clone and per-user worktrees live. */
  workDir: string;
  port: number;
  bind: string;
}

/**
 * The project a request without a project segment means (MPT-3). Exactly one configured
 * project makes that unambiguous; more than one makes it a question the caller must
 * answer, so this returns null rather than guessing.
 */
export function soleProject(config: ServerConfig): ProjectConfig | null {
  return config.projects.length === 1 ? config.projects[0] : null;
}

export function findProject(config: ServerConfig, id: string): ProjectConfig | null {
  return config.projects.find((p) => p.id === id) ?? null;
}

const DEFAULT_HEADERS = {
  user: 'x-forwarded-user',
  email: 'x-forwarded-email',
  name: 'x-forwarded-preferred-username',
  groups: 'x-forwarded-groups',
};

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);

/** A bind address that only accepts connections from this machine. */
export function isLoopbackBind(bind: string): boolean {
  return LOOPBACK.has(bind);
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((v) => typeof v === 'string')) return null;
  return value as string[];
}

/** Parse a role map, collecting problems under the given config path. */
function parseRoles(
  raw: unknown,
  where: string,
  errors: string[],
): Record<Role, string[]> | null {
  if (raw === undefined) return null;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    errors.push(`${where} must be an object mapping roles to group names`);
    return null;
  }
  const rolesRaw = raw as Record<string, unknown>;
  const roles = { reader: [], editor: [], committer: [] } as Record<Role, string[]>;
  for (const role of ROLES) {
    if (rolesRaw[role] === undefined) continue;
    const list = asStringArray(rolesRaw[role]);
    if (list === null) {
      errors.push(`${where}.${role} must be an array of group names`);
      continue;
    }
    roles[role] = list;
  }
  for (const key of Object.keys(rolesRaw)) {
    if (!ROLES.includes(key as Role)) {
      errors.push(`${where}.${key} is not a role (expected reader, editor, or committer)`);
    }
  }
  return roles;
}

/** Parse the repository half of a project entry (or the legacy root `repo`). */
function parseRepo(raw: Record<string, any>, where: string, errors: string[]): RepoConfig {
  if (typeof raw.url !== 'string' || raw.url.trim() === '') {
    errors.push(`${where}.url is required`);
  }
  if (typeof raw.branch !== 'string' || raw.branch.trim() === '') {
    errors.push(`${where}.branch is required`);
  }
  let paths = asStringArray(raw.paths) ?? ['docs/specpad/'];
  if (raw.paths !== undefined && asStringArray(raw.paths) === null) {
    errors.push(`${where}.paths must be an array of strings`);
    paths = ['docs/specpad/'];
  }
  if (paths.length === 0) errors.push(`${where}.paths must not be empty`);
  for (const p of paths) {
    if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) {
      errors.push(`${where}.paths entry "${p}" must be relative to the repository root`);
    }
    if (p.split(/[\\/]/).includes('..')) {
      errors.push(`${where}.paths entry "${p}" must not contain ".."`);
    }
  }
  return {
    url: raw.url,
    branch: raw.branch,
    credentialFile: raw.credentialFile,
    // Normalize to a trailing-slash-free, forward-slash form for prefix matching.
    paths: paths.map((p) => p.replace(/\\/g, '/').replace(/\/+$/, '')),
  };
}

/** Parse a commit policy, falling back to the given defaults. */
function parseCommit(raw: unknown, where: string, errors: string[], base: CommitConfig): CommitConfig {
  if (raw === undefined) return base;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    errors.push(`${where} must be an object`);
    return base;
  }
  const commitRaw = raw as Record<string, unknown>;
  const policy = commitRaw.requireGovernanceClean ?? base.requireGovernanceClean;
  if (policy !== 'block' && policy !== 'warn' && policy !== 'off') {
    errors.push(`${where}.requireGovernanceClean must be "block", "warn", or "off"`);
  }
  if (commitRaw.requireActiveJob !== undefined && typeof commitRaw.requireActiveJob !== 'boolean') {
    errors.push(`${where}.requireActiveJob must be a boolean`);
  }
  const pushRetries = commitRaw.pushRetries ?? base.pushRetries;
  if (typeof pushRetries !== 'number' || !Number.isInteger(pushRetries) || pushRetries < 0) {
    errors.push(`${where}.pushRetries must be a non-negative integer`);
  }
  return {
    requireActiveJob: (commitRaw.requireActiveJob as boolean) ?? base.requireActiveJob,
    requireGovernanceClean: policy as GovernancePolicy,
    pushRetries: pushRetries as number,
  };
}

/**
 * Validate raw config (parsed JSON) into a `ServerConfig`, collecting every problem
 * rather than failing on the first — an operator should see the whole list at once.
 */
export function validateConfig(raw: unknown): { config: ServerConfig | null; errors: string[] } {
  const errors: string[] = [];
  const root = (raw ?? {}) as Record<string, any>;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { config: null, errors: ['config must be a JSON object'] };
  }

  // ---- auth ----
  const authRaw = (root.auth ?? {}) as Record<string, any>;
  const provider = authRaw.provider as AuthProviderName;
  if (provider !== 'proxy' && provider !== 'dev') {
    errors.push('auth.provider must be one of "proxy", "dev"');
  }

  const trustedPeers = asStringArray(authRaw.trustedPeers) ?? [];
  if (authRaw.trustedPeers !== undefined && asStringArray(authRaw.trustedPeers) === null) {
    errors.push('auth.trustedPeers must be an array of strings');
  }
  // The proxy provider believes headers. Without a trusted peer, anyone who can reach
  // the port can assert any identity — so this is a refuse-to-start condition (AUTH-2).
  if (provider === 'proxy' && trustedPeers.length === 0) {
    errors.push('auth.trustedPeers is required when auth.provider is "proxy"');
  }

  const bind = typeof root.bind === 'string' ? root.bind : '127.0.0.1';
  // A fixed development identity reachable from the network is a vulnerability (AUTH-4).
  if (provider === 'dev' && !isLoopbackBind(bind)) {
    errors.push(`auth.provider "dev" may only be used with a loopback bind (got "${bind}")`);
  }


  const roles =
    parseRoles(authRaw.roles, 'auth.roles', errors) ??
    ({ reader: [], editor: [], committer: [] } as Record<Role, string[]>);

  const headersRaw = (authRaw.headers ?? {}) as Record<string, any>;
  const headers = { ...DEFAULT_HEADERS };
  for (const key of ['user', 'email', 'name', 'groups'] as const) {
    if (headersRaw[key] === undefined) continue;
    if (typeof headersRaw[key] !== 'string' || headersRaw[key].trim() === '') {
      errors.push(`auth.headers.${key} must be a non-empty string`);
      continue;
    }
    headers[key] = (headersRaw[key] as string).toLowerCase();
  }

  // ---- commit (the server-wide default a project may override) ----
  const commit = parseCommit(root.commit, 'commit', errors, {
    requireActiveJob: true,
    requireGovernanceClean: 'warn',
    pushRetries: 3,
  });

  // ---- projects (MPT-1) ----
  const projects: ProjectConfig[] = [];
  if (root.projects !== undefined && root.repo !== undefined) {
    errors.push('declare either "projects" or a single "repo", not both');
  } else if (root.projects !== undefined) {
    if (!Array.isArray(root.projects)) {
      errors.push('projects must be an array');
    } else if (root.projects.length === 0) {
      errors.push('projects must not be empty');
    } else {
      const seen = new Set<string>();
      root.projects.forEach((entry: unknown, i: number) => {
        const where = `projects[${i}]`;
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
          errors.push(`${where} must be an object`);
          return;
        }
        const raw = entry as Record<string, any>;
        const id = raw.id;
        if (typeof id !== 'string' || !PROJECT_ID.test(id)) {
          errors.push(
            `${where}.id is required and must contain only letters, digits, ".", "-" and "_"`,
          );
        } else if (seen.has(id)) {
          // Two projects answering to one name is unroutable, and the second would
          // silently shadow the first: refuse rather than pick.
          errors.push(`${where}.id "${id}" is already used by another project`);
        } else {
          seen.add(id);
        }
        projects.push({
          id: typeof id === 'string' ? id : `#${i}`,
          title: typeof raw.title === 'string' && raw.title.trim() !== '' ? raw.title : String(id ?? `#${i}`),
          repo: parseRepo(raw, where, errors),
          roles: parseRoles(raw.roles, `${where}.roles`, errors) ?? roles,
          commit: parseCommit(raw.commit, `${where}.commit`, errors, commit),
        });
      });
    }
  } else {
    // Legacy single-repository shape, read as a one-project deployment (MPT-2).
    const repoRaw = (root.repo ?? {}) as Record<string, any>;
    const id = typeof repoRaw.id === 'string' && repoRaw.id.trim() !== '' ? repoRaw.id : 'default';
    if (!PROJECT_ID.test(id)) {
      errors.push('repo.id must contain only letters, digits, ".", "-" and "_"');
    }
    projects.push({
      id,
      title: typeof repoRaw.title === 'string' && repoRaw.title.trim() !== '' ? repoRaw.title : id,
      repo: parseRepo(repoRaw, 'repo', errors),
      roles,
      commit,
    });
  }

  // A server nobody can sign in to is a misconfiguration, not a secure default. Checked
  // across the deployment: a project-level map is enough to make the server usable.
  const anyRole = (map: Record<Role, string[]>) => ROLES.some((r) => map[r].length > 0);
  if (provider !== 'dev' && !anyRole(roles) && !projects.some((p) => anyRole(p.roles))) {
    errors.push('auth.roles must grant at least one role to at least one group');
  }

  // ---- working-copy lifecycle (WCL-4) ----
  const wcRaw = (root.workingCopies ?? {}) as Record<string, any>;
  if (typeof root.workingCopies !== 'undefined' && (typeof root.workingCopies !== 'object' || root.workingCopies === null || Array.isArray(root.workingCopies))) {
    errors.push('workingCopies must be an object');
  }
  const seconds = (value: unknown, key: string, fallback: number): number => {
    if (value === undefined) return fallback;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      errors.push(`workingCopies.${key} must be a non-negative integer number of seconds`);
      return fallback;
    }
    return value;
  };
  // A day idle is a person who has gone home; re-provisioning costs one sparse checkout.
  const workingCopies: WorkingCopyConfig = {
    idleTimeout: seconds(wcRaw.idleTimeout, 'idleTimeout', 24 * 60 * 60),
    sweepInterval: seconds(wcRaw.sweepInterval, 'sweepInterval', 60 * 60),
  };
  if (workingCopies.sweepInterval === 0 && workingCopies.idleTimeout > 0) {
    errors.push('workingCopies.sweepInterval must be greater than zero when reaping is enabled');
  }

  // ---- server ----
  if (typeof root.workDir !== 'string' || root.workDir.trim() === '') {
    errors.push('workDir is required');
  }
  const port = root.port ?? 8080;
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('port must be an integer between 1 and 65535');
  }

  if (errors.length > 0) return { config: null, errors };

  return {
    config: {
      projects,
      workingCopies,
      auth: {
        provider,
        trustedPeers,
        headers,
        roles,
        devUser: authRaw.devUser ?? {
          id: 'dev',
          displayName: 'Development User',
          email: 'dev@localhost',
          groups: [],
        },
      },
      commit,
      workDir: root.workDir,
      port,
      bind,
    },
    errors: [],
  };
}

/** Validate or throw with every problem listed — the startup path (SRV-6). */
export function loadConfig(raw: unknown): ServerConfig {
  const { config, errors } = validateConfig(raw);
  if (!config) {
    throw new Error(`Invalid SpecPad server configuration:\n  - ${errors.join('\n  - ')}`);
  }
  return config;
}
