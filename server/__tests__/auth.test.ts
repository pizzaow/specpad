import { describe, it, expect } from 'vitest';
import {
  ProxyAuthProvider,
  DevAuthProvider,
  createAuthProvider,
  resolveSession,
  roleFor,
  can,
  matchesPeer,
  isTrustedPeer,
} from '../auth';
import { validateConfig } from '../config';
import type { AuthConfig } from '../config';

function authConfig(overrides: Record<string, unknown> = {}): AuthConfig {
  const { config } = validateConfig({
    repo: { url: 'git@x:y.git', branch: 'main' },
    workDir: '/srv/specpad',
    auth: {
      provider: 'proxy',
      trustedPeers: ['10.0.0.0/8'],
      roles: { committer: ['grp-quality'], editor: ['grp-eng'], reader: ['grp-all'] },
      ...overrides,
    },
    ...(overrides.provider === 'dev' ? { bind: '127.0.0.1' } : {}),
  });
  if (!config) throw new Error('test config is invalid');
  return config.auth;
}

const PROXY_HEADERS = {
  'x-forwarded-user': 'jane',
  'x-forwarded-email': 'jane@corp.example',
  'x-forwarded-preferred-username': 'Jane Smith',
  'x-forwarded-groups': 'grp-quality, grp-all',
};

describe('ProxyAuthProvider (AUTH-2)', () => {
  it('builds a principal from headers sent by a trusted upstream', async () => {
    const provider = new ProxyAuthProvider(authConfig());

    const principal = await provider.authenticate({
      headers: PROXY_HEADERS,
      remoteAddress: '10.4.1.9',
    });

    expect(principal).toEqual({
      id: 'jane',
      displayName: 'Jane Smith',
      email: 'jane@corp.example',
      groups: ['grp-quality', 'grp-all'],
    });
  });

  it('ignores identical headers presented by an untrusted peer', async () => {
    const provider = new ProxyAuthProvider(authConfig());

    const principal = await provider.authenticate({
      headers: PROXY_HEADERS,
      remoteAddress: '203.0.113.7',
    });

    expect(principal).toBeNull();
  });

  it('ignores headers when the peer address is unknown', async () => {
    const provider = new ProxyAuthProvider(authConfig());

    expect(await provider.authenticate({ headers: PROXY_HEADERS })).toBeNull();
  });

  it('trusts an IPv4-mapped IPv6 peer address from a dual-stack socket', async () => {
    const provider = new ProxyAuthProvider(authConfig());

    const principal = await provider.authenticate({
      headers: PROXY_HEADERS,
      remoteAddress: '::ffff:10.4.1.9',
    });

    expect(principal?.email).toBe('jane@corp.example');
  });

  it('refuses an identity with no email, because a commit needs an author (AUTH-6)', async () => {
    const provider = new ProxyAuthProvider(authConfig());

    const principal = await provider.authenticate({
      headers: { 'x-forwarded-user': 'jane' },
      remoteAddress: '10.4.1.9',
    });

    expect(principal).toBeNull();
  });

  it('falls back to the email as id and display name when the proxy sends no user header', async () => {
    const provider = new ProxyAuthProvider(authConfig());

    const principal = await provider.authenticate({
      headers: { 'x-forwarded-email': 'jane@corp.example' },
      remoteAddress: '10.4.1.9',
    });

    expect(principal).toEqual({
      id: 'jane@corp.example',
      displayName: 'jane@corp.example',
      email: 'jane@corp.example',
      groups: [],
    });
  });

  it('reads the header names the operator configured', async () => {
    const provider = new ProxyAuthProvider(authConfig({ headers: { email: 'X-Auth-Email' } }));

    const principal = await provider.authenticate({
      headers: { 'x-auth-email': 'kim@corp.example' },
      remoteAddress: '10.0.0.1',
    });

    expect(principal?.email).toBe('kim@corp.example');
  });
});

describe('DevAuthProvider (AUTH-4)', () => {
  it('returns the fixed development identity', async () => {
    const provider = new DevAuthProvider(authConfig({ provider: 'dev', roles: {} }));

    const principal = await provider.authenticate();

    expect(principal).toEqual({
      id: 'dev',
      displayName: 'Development User',
      email: 'dev@localhost',
      groups: [],
    });
  });
});

describe('createAuthProvider (AUTH-1)', () => {
  it('builds the provider the configuration names', () => {
    expect(createAuthProvider(authConfig()).name).toBe('proxy');
    expect(createAuthProvider(authConfig({ provider: 'dev', roles: {} })).name).toBe('dev');
  });
});

describe('roleFor (AUTH-5)', () => {
  const roles = { committer: ['grp-quality'], editor: ['grp-eng'], reader: ['grp-all'] };

  it('grants the role a group maps to', () => {
    expect(roleFor(roles, ['grp-quality'])).toBe('committer');
    expect(roleFor(roles, ['grp-eng'])).toBe('editor');
    expect(roleFor(roles, ['grp-all'])).toBe('reader');
  });

  it('grants the strongest role when a user is in several groups', () => {
    expect(roleFor(roles, ['grp-all', 'grp-eng', 'grp-quality'])).toBe('committer');
    expect(roleFor(roles, ['grp-all', 'grp-eng'])).toBe('editor');
  });

  it('denies a principal matching no mapping rather than defaulting to a role', () => {
    expect(roleFor(roles, ['grp-contractors'])).toBeNull();
    expect(roleFor(roles, [])).toBeNull();
  });
});

describe('can', () => {
  it('lets a reader read but not write or commit', () => {
    expect(can('reader', 'read')).toBe(true);
    expect(can('reader', 'write')).toBe(false);
    expect(can('reader', 'commit')).toBe(false);
  });

  it('lets an editor write but not commit (EDR-3)', () => {
    expect(can('editor', 'write')).toBe(true);
    expect(can('editor', 'commit')).toBe(false);
  });

  it('lets a committer do everything', () => {
    expect(can('committer', 'commit')).toBe(true);
  });

  it('lets an unauthorized principal do nothing', () => {
    expect(can(null, 'read')).toBe(false);
  });
});

describe('matchesPeer', () => {
  it('matches an exact address', () => {
    expect(matchesPeer('10.4.1.9', '10.4.1.9')).toBe(true);
    expect(matchesPeer('10.4.1.9', '10.4.1.10')).toBe(false);
  });

  it('matches inside an IPv4 CIDR block', () => {
    expect(matchesPeer('10.0.0.0/8', '10.255.3.1')).toBe(true);
    expect(matchesPeer('10.0.0.0/8', '11.0.0.1')).toBe(false);
    expect(matchesPeer('192.168.1.0/24', '192.168.1.77')).toBe(true);
    expect(matchesPeer('192.168.1.0/24', '192.168.2.77')).toBe(false);
  });

  it('matches a /32 as a single host and /0 as everything', () => {
    expect(matchesPeer('10.1.2.3/32', '10.1.2.3')).toBe(true);
    expect(matchesPeer('10.1.2.3/32', '10.1.2.4')).toBe(false);
    expect(matchesPeer('0.0.0.0/0', '203.0.113.1')).toBe(true);
  });

  it('rejects malformed rules and addresses instead of matching loosely', () => {
    expect(matchesPeer('10.0.0.0/33', '10.0.0.1')).toBe(false);
    expect(matchesPeer('not-an-ip/8', '10.0.0.1')).toBe(false);
    expect(matchesPeer('10.0.0.0/8', 'not-an-ip')).toBe(false);
    expect(matchesPeer('999.0.0.0/8', '10.0.0.1')).toBe(false);
  });

  it('matches an exact IPv6 peer', () => {
    expect(isTrustedPeer(['::1'], '::1')).toBe(true);
    expect(isTrustedPeer(['::1'], '::2')).toBe(false);
  });
});

describe('resolveSession (AUTH-1, AUTH-5)', () => {
  it('returns the principal and role for an authorized user', async () => {
    const config = authConfig();
    const session = await resolveSession(createAuthProvider(config), config, {
      headers: PROXY_HEADERS,
      remoteAddress: '10.4.1.9',
    });

    expect(session?.principal.email).toBe('jane@corp.example');
    expect(session?.role).toBe('committer');
  });

  it('returns null when the user authenticates but matches no role', async () => {
    const config = authConfig();
    const session = await resolveSession(createAuthProvider(config), config, {
      headers: { ...PROXY_HEADERS, 'x-forwarded-groups': 'grp-contractors' },
      remoteAddress: '10.4.1.9',
    });

    expect(session).toBeNull();
  });

  it('returns null when the user is not authenticated at all', async () => {
    const config = authConfig();
    const session = await resolveSession(createAuthProvider(config), config, {
      headers: PROXY_HEADERS,
      remoteAddress: '203.0.113.7',
    });

    expect(session).toBeNull();
  });

  it('gives the loopback development identity full access with no role map', async () => {
    const config = authConfig({ provider: 'dev', roles: {} });
    const session = await resolveSession(createAuthProvider(config), config, { headers: {} });

    expect(session?.role).toBe('committer');
  });

  it('still honours an explicit role map under the dev provider', async () => {
    const config = authConfig({
      provider: 'dev',
      roles: { reader: ['grp-all'], editor: [], committer: [] },
      devUser: { id: 'dev', displayName: 'Dev', email: 'dev@localhost', groups: ['grp-all'] },
    });
    const session = await resolveSession(createAuthProvider(config), config, { headers: {} });

    expect(session?.role).toBe('reader');
  });
});
