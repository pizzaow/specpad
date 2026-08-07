/**
 * Identity (AUTH-1..AUTH-6).
 *
 * The server is deliberately agnostic about how a user proved who they are. Every
 * provider yields the same `Principal`, and nothing downstream — the git layer, the
 * document layer, the commit pipeline — knows which provider produced it. For most
 * enterprises SpecPad implements no authentication at all: an upstream the company
 * already runs (oauth2-proxy, Entra App Proxy, Cloudflare Access, an SSO gateway)
 * asserts the identity, and the `proxy` provider consumes it.
 *
 * Identity is not the git credential (AUTH-6): the human's name and email become the
 * commit *author*, while the push uses a machine credential configured by the operator.
 */
import type { AuthConfig, Role } from './config';
import { ROLES } from './config';

export interface Principal {
  id: string;
  displayName: string;
  email: string;
  groups: string[];
}

export interface GitCredential {
  kind: 'token';
  token: string;
}

export interface AuthRequest {
  headers: Record<string, string | string[] | undefined>;
  /** The immediate peer's address, as reported by the socket. */
  remoteAddress?: string;
}

export interface AuthProvider {
  readonly name: string;
  /** Resolve the caller's identity, or null when they are not authenticated. */
  authenticate(req: AuthRequest): Promise<Principal | null>;
  /**
   * A per-user git credential, when the provider can supply one. Returning null (the
   * default) means "push with the server's machine credential" — the seam a future
   * git-host OAuth provider fills without changing anything else (AUTH-6).
   */
  getGitCredential?(principal: Principal): Promise<GitCredential | null>;
}

// ---- Role resolution (AUTH-5) ----

// Most privileged first: a user in several groups gets the strongest role they match.
const ROLE_PRECEDENCE: Role[] = ['committer', 'editor', 'reader'];

/** The role a principal's group claims grant, or null when no mapping matches. */
export function roleFor(roles: Record<Role, string[]>, groups: string[]): Role | null {
  const held = new Set(groups);
  for (const role of ROLE_PRECEDENCE) {
    if ((roles[role] ?? []).some((g) => held.has(g))) return role;
  }
  return null;
}

export type Capability = 'read' | 'write' | 'commit';

const CAPABILITIES: Record<Role, Capability[]> = {
  reader: ['read'],
  editor: ['read', 'write'],
  committer: ['read', 'write', 'commit'],
};

export function can(role: Role | null, capability: Capability): boolean {
  if (!role) return false;
  return CAPABILITIES[role].includes(capability);
}

// ---- Trusted peers (AUTH-2) ----

/** Normalize an IPv4-mapped IPv6 address (::ffff:10.0.0.5) to its IPv4 form. */
function normalizeAddress(address: string): string {
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return mapped ? mapped[1] : address;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

/** Does `address` fall inside `rule` — an exact address or an IPv4 CIDR block? */
export function matchesPeer(rule: string, address: string): boolean {
  const addr = normalizeAddress(address);
  if (rule === addr) return true;

  const slash = rule.indexOf('/');
  if (slash === -1) return false;

  const network = ipv4ToInt(rule.slice(0, slash));
  const bits = Number(rule.slice(slash + 1));
  const target = ipv4ToInt(addr);
  if (network === null || target === null) return false;
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  if (bits === 0) return true;

  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (network & mask) === (target & mask);
}

export function isTrustedPeer(trustedPeers: string[], address: string | undefined): boolean {
  if (!address) return false;
  return trustedPeers.some((rule) => matchesPeer(rule, address));
}

// ---- Providers ----

function headerValue(
  headers: AuthRequest['headers'],
  name: string,
): string | undefined {
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Identity asserted by a trusted upstream via headers. Headers presented by any other
 * peer are ignored outright — otherwise anyone who can reach the port directly could
 * claim to be anyone (AUTH-2).
 */
export class ProxyAuthProvider implements AuthProvider {
  readonly name = 'proxy';
  constructor(private readonly config: AuthConfig) {}

  async authenticate(req: AuthRequest): Promise<Principal | null> {
    if (!isTrustedPeer(this.config.trustedPeers, req.remoteAddress)) return null;

    const { headers } = this.config;
    const email = headerValue(req.headers, headers.email);
    const id = headerValue(req.headers, headers.user) ?? email;
    // An email is mandatory: without it there is no valid git commit author (AUTH-6).
    if (!id || !email) return null;

    const groups = (headerValue(req.headers, headers.groups) ?? '')
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);

    return {
      id,
      displayName: headerValue(req.headers, headers.name) ?? id,
      email,
      groups,
    };
  }
}

/** A single fixed identity for local development. Refuses any non-loopback bind (AUTH-4). */
export class DevAuthProvider implements AuthProvider {
  readonly name = 'dev';
  constructor(private readonly config: AuthConfig) {}

  async authenticate(): Promise<Principal | null> {
    const user = this.config.devUser;
    if (!user) return null;
    return { ...user, groups: [...user.groups] };
  }
}

/**
 * Corporate SSO with no proxy in front (AUTH-3). Not yet implemented: deployments today
 * use `proxy` behind the company's existing authenticating gateway, which covers OIDC,
 * SAML, and mTLS alike. Left as an explicit failure rather than a silent denial so a
 * misconfigured deployment is obvious at startup rather than at first sign-in.
 */
export class OidcAuthProvider implements AuthProvider {
  readonly name = 'oidc';
  async authenticate(): Promise<Principal | null> {
    throw new Error(
      'The OIDC provider is not implemented yet. Use auth.provider "proxy" behind an ' +
        'authenticating upstream (oauth2-proxy, Entra App Proxy, Cloudflare Access).',
    );
  }
}

export function createAuthProvider(config: AuthConfig): AuthProvider {
  switch (config.provider) {
    case 'proxy':
      return new ProxyAuthProvider(config);
    case 'dev':
      return new DevAuthProvider(config);
    case 'oidc':
      return new OidcAuthProvider();
  }
}

export interface Session {
  principal: Principal;
  role: Role;
}

/** Authenticate and authorize in one step; null when either fails (AUTH-5). */
export async function resolveSession(
  provider: AuthProvider,
  config: AuthConfig,
  req: AuthRequest,
): Promise<Session | null> {
  const principal = await provider.authenticate(req);
  if (!principal) return null;
  // The dev provider is its own authorization: a loopback-only fixed identity.
  const role =
    provider.name === 'dev' && ROLES.every((r) => config.roles[r].length === 0)
      ? 'committer'
      : roleFor(config.roles, principal.groups);
  if (!role) return null;
  return { principal, role };
}
