/**
 * Server configuration (SRV-6).
 *
 * One declarative file describes the whole deployment: which repository, which branch,
 * which credential, which authentication provider, who gets which role, and how strict
 * the commit gate is. Validation is exhaustive and startup-blocking — a server that
 * comes up half-configured is worse than one that refuses to come up, because it holds
 * push access to a real repository.
 */

import { editorVersionPath } from '../src/shared';

/**
 * The editor build path this server serves — one definition, shared with the launcher:
 * schemaVersion "1.0" → /v01/. Old version paths stay live forever, so documents always
 * open in an editor that understands them.
 */
export const SCHEMA_VERSION_PATH = editorVersionPath().replace(/\/$/, '');

export type AuthProviderName = 'proxy' | 'oidc' | 'dev';
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
  /** OIDC settings (issuer, client id/secret, redirect) — provider `oidc` only. */
  oidc?: { issuer: string; clientId: string; clientSecret: string; redirectUri: string };
}

export interface CommitConfig {
  requireActiveJob: boolean;
  requireGovernanceClean: GovernancePolicy;
  /** Bounded retries when a push is rejected as non-fast-forward (CMT-6). */
  pushRetries: number;
}

export interface ServerConfig {
  repo: RepoConfig;
  auth: AuthConfig;
  commit: CommitConfig;
  /** Where the bare clone and per-user worktrees live. */
  workDir: string;
  port: number;
  bind: string;
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

  // ---- repo ----
  const repoRaw = (root.repo ?? {}) as Record<string, any>;
  if (typeof repoRaw.url !== 'string' || repoRaw.url.trim() === '') {
    errors.push('repo.url is required');
  }
  if (typeof repoRaw.branch !== 'string' || repoRaw.branch.trim() === '') {
    errors.push('repo.branch is required');
  }
  let paths = asStringArray(repoRaw.paths) ?? ['docs/specpad/'];
  if (repoRaw.paths !== undefined && asStringArray(repoRaw.paths) === null) {
    errors.push('repo.paths must be an array of strings');
    paths = ['docs/specpad/'];
  }
  if (paths.length === 0) errors.push('repo.paths must not be empty');
  for (const p of paths) {
    if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) {
      errors.push(`repo.paths entry "${p}" must be relative to the repository root`);
    }
    if (p.split(/[\\/]/).includes('..')) {
      errors.push(`repo.paths entry "${p}" must not contain ".."`);
    }
  }

  // ---- auth ----
  const authRaw = (root.auth ?? {}) as Record<string, any>;
  const provider = authRaw.provider as AuthProviderName;
  if (provider !== 'proxy' && provider !== 'oidc' && provider !== 'dev') {
    errors.push('auth.provider must be one of "proxy", "oidc", "dev"');
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

  if (provider === 'oidc') {
    const oidc = (authRaw.oidc ?? {}) as Record<string, any>;
    for (const key of ['issuer', 'clientId', 'clientSecret', 'redirectUri']) {
      if (typeof oidc[key] !== 'string' || oidc[key].trim() === '') {
        errors.push(`auth.oidc.${key} is required when auth.provider is "oidc"`);
      }
    }
  }

  const rolesRaw = (authRaw.roles ?? {}) as Record<string, any>;
  const roles = { reader: [], editor: [], committer: [] } as Record<Role, string[]>;
  for (const role of ROLES) {
    const groups = rolesRaw[role];
    if (groups === undefined) continue;
    const list = asStringArray(groups);
    if (list === null) {
      errors.push(`auth.roles.${role} must be an array of group names`);
      continue;
    }
    roles[role] = list;
  }
  for (const key of Object.keys(rolesRaw)) {
    if (!ROLES.includes(key as Role)) {
      errors.push(`auth.roles.${key} is not a role (expected reader, editor, or committer)`);
    }
  }
  // A server nobody can sign in to is a misconfiguration, not a secure default.
  if (provider !== 'dev' && ROLES.every((r) => roles[r].length === 0)) {
    errors.push('auth.roles must grant at least one role to at least one group');
  }

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

  // ---- commit ----
  const commitRaw = (root.commit ?? {}) as Record<string, any>;
  const policy = commitRaw.requireGovernanceClean ?? 'warn';
  if (policy !== 'block' && policy !== 'warn' && policy !== 'off') {
    errors.push('commit.requireGovernanceClean must be "block", "warn", or "off"');
  }
  if (commitRaw.requireActiveJob !== undefined && typeof commitRaw.requireActiveJob !== 'boolean') {
    errors.push('commit.requireActiveJob must be a boolean');
  }
  const pushRetries = commitRaw.pushRetries ?? 3;
  if (typeof pushRetries !== 'number' || !Number.isInteger(pushRetries) || pushRetries < 0) {
    errors.push('commit.pushRetries must be a non-negative integer');
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
      repo: {
        url: repoRaw.url,
        branch: repoRaw.branch,
        credentialFile: repoRaw.credentialFile,
        // Normalize to a trailing-slash-free, forward-slash form for prefix matching.
        paths: paths.map((p) => p.replace(/\\/g, '/').replace(/\/+$/, '')),
      },
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
        oidc: authRaw.oidc,
      },
      commit: {
        requireActiveJob: commitRaw.requireActiveJob ?? true,
        requireGovernanceClean: policy as GovernancePolicy,
        pushRetries,
      },
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
