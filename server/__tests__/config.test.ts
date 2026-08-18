import { describe, it, expect } from 'vitest';
import { validateConfig, loadConfig, isLoopbackBind } from '../config';

// SRV-6: one declarative file, and a server that refuses to start half-configured.

const valid = {
  repo: { url: 'git@git.corp:product/acme.git', branch: 'main' },
  auth: {
    provider: 'proxy',
    trustedPeers: ['10.0.0.0/8'],
    roles: { committer: ['grp-quality'], editor: ['grp-eng'], reader: ['grp-all'] },
  },
  workDir: '/srv/specpad',
};

describe('validateConfig — accepting a good configuration', () => {
  it('accepts a minimal valid configuration and applies defaults', () => {
    const { config, errors } = validateConfig(valid);

    expect(errors).toEqual([]);
    expect(config).not.toBeNull();
    expect(config!.projects[0].repo.paths).toEqual(['docs/specpad']);
    expect(config!.commit).toEqual({
      requireActiveJob: true,
      requireGovernanceClean: 'warn',
      pushRetries: 3,
    });
    expect(config!.port).toBe(8080);
    expect(config!.auth.headers.email).toBe('x-forwarded-email');
  });

  it('normalizes allowlisted paths to a trailing-slash-free form', () => {
    const { config } = validateConfig({
      ...valid,
      repo: { ...valid.repo, paths: ['docs/specpad/', 'docs\\extra\\'] },
    });

    expect(config!.projects[0].repo.paths).toEqual(['docs/specpad', 'docs/extra']);
  });

  it('lets an operator override the identity header names', () => {
    const { config } = validateConfig({
      ...valid,
      auth: { ...valid.auth, headers: { email: 'X-Auth-Email' } },
    });

    expect(config!.auth.headers.email).toBe('x-auth-email');
    expect(config!.auth.headers.user).toBe('x-forwarded-user');
  });
});

describe('validateConfig — refusing a bad configuration', () => {
  it('reports every problem at once rather than only the first', () => {
    const { config, errors } = validateConfig({ auth: { provider: 'nope' } });

    expect(config).toBeNull();
    expect(errors).toEqual(
      expect.arrayContaining([
        'repo.url is required',
        'repo.branch is required',
        'auth.provider must be one of "proxy", "dev"',
        'workDir is required',
      ]),
    );
  });

  it('requires a repository and a branch', () => {
    expect(validateConfig({ ...valid, repo: { branch: 'main' } }).errors).toContain(
      'repo.url is required',
    );
    expect(validateConfig({ ...valid, repo: { url: 'x' } }).errors).toContain(
      'repo.branch is required',
    );
  });

  it('refuses an allowlisted path that is absolute or escapes the repository', () => {
    expect(
      validateConfig({ ...valid, repo: { ...valid.repo, paths: ['/etc'] } }).errors,
    ).toContain('repo.paths entry "/etc" must be relative to the repository root');
    expect(
      validateConfig({ ...valid, repo: { ...valid.repo, paths: ['../secrets'] } }).errors,
    ).toContain('repo.paths entry "../secrets" must not contain ".."');
    expect(
      validateConfig({ ...valid, repo: { ...valid.repo, paths: [] } }).errors,
    ).toContain('repo.paths must not be empty');
  });

  it('refuses the proxy provider with no trusted peer (AUTH-2)', () => {
    const { config, errors } = validateConfig({
      ...valid,
      auth: { ...valid.auth, trustedPeers: [] },
    });

    expect(config).toBeNull();
    expect(errors).toContain('auth.trustedPeers is required when auth.provider is "proxy"');
  });

  it('refuses the dev provider on a non-loopback bind (AUTH-4)', () => {
    const devOnLoopback = validateConfig({
      ...valid,
      auth: { provider: 'dev', roles: {} },
      bind: '127.0.0.1',
    });
    expect(devOnLoopback.errors).toEqual([]);

    const devExposed = validateConfig({
      ...valid,
      auth: { provider: 'dev', roles: {} },
      bind: '0.0.0.0',
    });
    expect(devExposed.config).toBeNull();
    expect(devExposed.errors).toContain(
      'auth.provider "dev" may only be used with a loopback bind (got "0.0.0.0")',
    );
  });

  it('refuses "oidc" as a provider rather than accepting it and failing at sign-in', () => {
    // It used to validate a complete OIDC block and hand back a provider that threw the
    // first time somebody logged in. Corporate SSO goes through `proxy` behind the
    // company's gateway, so the config is refused at startup where it is cheap to fix.
    const { config, errors } = validateConfig({ ...valid, auth: { ...valid.auth, provider: 'oidc' } });

    expect(config).toBeNull();
    expect(errors).toContain('auth.provider must be one of "proxy", "dev"');
  });

  it('refuses a configuration where no group is granted any role', () => {
    const { errors } = validateConfig({ ...valid, auth: { ...valid.auth, roles: {} } });

    expect(errors).toContain('auth.roles must grant at least one role to at least one group');
  });

  it('rejects an unknown role name', () => {
    const { errors } = validateConfig({
      ...valid,
      auth: { ...valid.auth, roles: { ...valid.auth.roles, admin: ['grp-x'] } },
    });

    expect(errors).toContain('auth.roles.admin is not a role (expected reader, editor, or committer)');
  });

  it('rejects an out-of-range commit policy, port, and retry count', () => {
    expect(
      validateConfig({ ...valid, commit: { requireGovernanceClean: 'maybe' } }).errors,
    ).toContain('commit.requireGovernanceClean must be "block", "warn", or "off"');
    expect(validateConfig({ ...valid, port: 99999 }).errors).toContain(
      'port must be an integer between 1 and 65535',
    );
    expect(validateConfig({ ...valid, commit: { pushRetries: -1 } }).errors).toContain(
      'commit.pushRetries must be a non-negative integer',
    );
  });

  it('rejects a configuration that is not an object', () => {
    expect(validateConfig('nope').errors).toEqual(['config must be a JSON object']);
    expect(validateConfig(null).errors).toEqual(['config must be a JSON object']);
  });
});

describe('loadConfig', () => {
  it('returns the configuration when it is valid', () => {
    expect(loadConfig(valid).projects[0].repo.branch).toBe('main');
  });

  it('throws with every problem listed, so startup fails loudly', () => {
    expect(() => loadConfig({})).toThrow(/Invalid SpecPad server configuration/);
    expect(() => loadConfig({})).toThrow(/repo\.url is required/);
    expect(() => loadConfig({})).toThrow(/workDir is required/);
  });
});

describe('isLoopbackBind', () => {
  it('recognizes loopback addresses only', () => {
    expect(isLoopbackBind('127.0.0.1')).toBe(true);
    expect(isLoopbackBind('::1')).toBe(true);
    expect(isLoopbackBind('localhost')).toBe(true);
    expect(isLoopbackBind('0.0.0.0')).toBe(false);
    expect(isLoopbackBind('10.1.2.3')).toBe(false);
  });
});
