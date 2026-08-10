import { describe, it, expect } from 'vitest';
import { validateConfig, loadConfig, soleProject, findProject } from '../config';
import { parseApiPath, projectApiPath } from '../routing';
import { sessionFor, roleFor } from '../auth';
import type { AuthProvider, Principal } from '../auth';

/**
 * Multi-project tenancy (MPT-1..MPT-8): one server, several repositories.
 *
 * The security-relevant claim here is that a project boundary is real — a principal's
 * role, working copy, and event stream are per project, and holding no role in one says
 * nothing about the others.
 */

const auth = {
  provider: 'proxy',
  trustedPeers: ['10.0.0.0/8'],
  roles: { committer: ['grp-quality'], editor: ['grp-eng'], reader: ['grp-all'] },
};

const multi = {
  projects: [
    { id: 'acme', title: 'Acme Firmware', url: 'git@git.corp:product/acme.git', branch: 'main' },
    {
      id: 'beta',
      url: 'git@git.corp:product/beta.git',
      branch: 'release',
      paths: ['docs/specpad', 'docs/extra'],
      roles: { reader: ['grp-all'] },
    },
    { id: 'gamma', url: 'git@git.corp:product/gamma.git', branch: 'main' },
  ],
  auth,
  workDir: '/srv/specpad',
};

const legacy = {
  repo: { url: 'git@git.corp:product/acme.git', branch: 'main' },
  auth,
  workDir: '/srv/specpad',
};

// ---- MPT-1: several projects from one file ----

describe('configuration — several projects (MPT-1)', () => {
  it('accepts a list of projects, each with its own repository and branch', () => {
    const { config, errors } = validateConfig(multi);

    expect(errors).toEqual([]);
    expect(config!.projects.map((p) => p.id)).toEqual(['acme', 'beta', 'gamma']);
    expect(config!.projects[1].repo).toMatchObject({
      url: 'git@git.corp:product/beta.git',
      branch: 'release',
      paths: ['docs/specpad', 'docs/extra'],
    });
  });

  it('titles a project by its id when the operator gives no title', () => {
    const { config } = validateConfig(multi);

    expect(config!.projects[0].title).toBe('Acme Firmware');
    expect(config!.projects[2].title).toBe('gamma');
  });

  it('refuses to start when two projects share an identifier', () => {
    const { config, errors } = validateConfig({
      ...multi,
      projects: [multi.projects[0], { ...multi.projects[1], id: 'acme' }],
    });

    expect(config).toBeNull();
    expect(errors).toEqual(
      expect.arrayContaining([expect.stringContaining('"acme" is already used')]),
    );
  });

  it('refuses an identifier that is not safe in a URL or a directory name', () => {
    for (const id of ['../escape', 'has space', '', 'a/b']) {
      const { config } = validateConfig({ ...multi, projects: [{ ...multi.projects[0], id }] });
      expect(config, `id ${JSON.stringify(id)} must be refused`).toBeNull();
    }
  });

  it('validates every project, not just the first', () => {
    const { errors } = validateConfig({
      ...multi,
      projects: [multi.projects[0], { id: 'beta' }],
    });

    expect(errors).toEqual(
      expect.arrayContaining(['projects[1].url is required', 'projects[1].branch is required']),
    );
  });

  it('refuses a configuration that declares both a project list and a single repo', () => {
    const { config, errors } = validateConfig({ ...multi, repo: legacy.repo });

    expect(config).toBeNull();
    expect(errors).toEqual(
      expect.arrayContaining([expect.stringContaining('either "projects" or a single "repo"')]),
    );
  });
});

// ---- MPT-2: the single-repository config still works ----

describe('configuration — the existing single-repository shape (MPT-2)', () => {
  it('reads a single repo as a one-project deployment, asking nothing new of the operator', () => {
    const { config, errors } = validateConfig(legacy);

    expect(errors).toEqual([]);
    expect(config!.projects).toHaveLength(1);
    expect(config!.projects[0]).toMatchObject({
      id: 'default',
      repo: { url: 'git@git.corp:product/acme.git', branch: 'main', paths: ['docs/specpad'] },
    });
  });

  it('gives the sole project the server-wide roles and commit policy', () => {
    const config = loadConfig({ ...legacy, commit: { requireGovernanceClean: 'block' } });

    expect(config.projects[0].roles).toEqual(config.auth.roles);
    expect(config.projects[0].commit.requireGovernanceClean).toBe('block');
  });
});

// ---- MPT-5: per-project roles and commit policy ----

describe('configuration — per-project policy (MPT-5)', () => {
  it('lets a project declare its own roles, and inherits the server-wide map otherwise', () => {
    const config = loadConfig(multi);
    const [acme, beta] = config.projects;

    expect(beta.roles).toEqual({ reader: ['grp-all'], editor: [], committer: [] });
    expect(acme.roles).toEqual(config.auth.roles);
  });

  it('lets a project tighten the commit policy without changing the others', () => {
    const config = loadConfig({
      ...multi,
      commit: { requireGovernanceClean: 'warn' },
      projects: [
        { ...multi.projects[0], commit: { requireGovernanceClean: 'block' } },
        multi.projects[1],
      ],
    });

    expect(config.projects[0].commit.requireGovernanceClean).toBe('block');
    expect(config.projects[1].commit.requireGovernanceClean).toBe('warn');
    // Unstated fields still come from the server-wide policy.
    expect(config.projects[0].commit.pushRetries).toBe(3);
  });

  it('accepts a deployment whose roles are declared only per project', () => {
    const { config, errors } = validateConfig({
      projects: [{ id: 'acme', url: 'git@x:y.git', branch: 'main', roles: { reader: ['grp-all'] } }],
      auth: { provider: 'proxy', trustedPeers: ['10.0.0.0/8'] },
      workDir: '/srv/specpad',
    });

    expect(errors).toEqual([]);
    expect(config!.projects[0].roles.reader).toEqual(['grp-all']);
  });
});

// ---- MPT-3: routing ----

describe('routing a request to a project (MPT-3)', () => {
  it('reads the project out of a project-scoped path', () => {
    expect(parseApiPath('/p/acme/doc/acme.srs.json')).toEqual({
      projectId: 'acme',
      path: '/doc/acme.srs.json',
    });
    expect(parseApiPath('/p/acme/session')).toEqual({ projectId: 'acme', path: '/session' });
    expect(parseApiPath('/p/acme')).toEqual({ projectId: 'acme', path: '/' });
  });

  it('reports no project for an unprefixed path, rather than inventing one', () => {
    expect(parseApiPath('/session')).toEqual({ projectId: null, path: '/session' });
    expect(parseApiPath('/projects')).toEqual({ projectId: null, path: '/projects' });
  });

  it('round-trips a project id that needs encoding', () => {
    const path = projectApiPath('a.b-c_1', '/status');

    expect(parseApiPath(path)).toEqual({ projectId: 'a.b-c_1', path: '/status' });
  });

  it('resolves an unnamed project only when the deployment has exactly one', () => {
    expect(soleProject(loadConfig(legacy))?.id).toBe('default');
    expect(soleProject(loadConfig(multi))).toBeNull();
  });

  it('finds a project by id, and reports an unknown one as absent', () => {
    const config = loadConfig(multi);

    expect(findProject(config, 'beta')?.repo.branch).toBe('release');
    expect(findProject(config, 'nope')).toBeNull();
  });
});

// ---- MPT-5/MPT-6: authorization is per project ----

const proxy = { name: 'proxy' } as AuthProvider;

const principal = (groups: string[]): Principal => ({
  id: 'jane',
  displayName: 'Jane Smith',
  email: 'jane@corp.example',
  groups,
});

describe('authorization across projects (MPT-5, MPT-6)', () => {
  it('gives one principal different roles in different projects', () => {
    const config = loadConfig({
      ...multi,
      projects: [
        { ...multi.projects[0], roles: { committer: ['grp-quality'] } },
        { ...multi.projects[1], roles: { reader: ['grp-quality'] } },
      ],
    });
    const jane = principal(['grp-quality']);

    expect(sessionFor(proxy, jane, config.projects[0].roles)?.role).toBe('committer');
    expect(sessionFor(proxy, jane, config.projects[1].roles)?.role).toBe('reader');
  });

  it('refuses a project the principal holds no role in, without touching the others', () => {
    const config = loadConfig({
      ...multi,
      projects: [
        { ...multi.projects[0], roles: { editor: ['grp-eng'] } },
        { ...multi.projects[1], roles: { editor: ['grp-finance'] } },
      ],
    });
    const jane = principal(['grp-eng']);

    expect(sessionFor(proxy, jane, config.projects[0].roles)?.role).toBe('editor');
    expect(sessionFor(proxy, jane, config.projects[1].roles)).toBeNull();
  });

  it('grants the strongest role the principal matches, per project', () => {
    const roles = { committer: ['grp-quality'], editor: ['grp-eng'], reader: ['grp-all'] };

    expect(roleFor(roles, ['grp-all', 'grp-quality'])).toBe('committer');
    expect(roleFor(roles, ['grp-all', 'grp-eng'])).toBe('editor');
    expect(roleFor(roles, ['grp-none'])).toBeNull();
  });
});

// ---- WCL-4: the reaping policy is configuration, not a constant ----

describe('working-copy reaping policy (WCL-4)', () => {
  it('defaults to a day idle, swept hourly', () => {
    expect(loadConfig(legacy).workingCopies).toEqual({
      idleTimeout: 24 * 60 * 60,
      sweepInterval: 60 * 60,
    });
  });

  it('honours a configured idle period', () => {
    const config = loadConfig({ ...legacy, workingCopies: { idleTimeout: 900, sweepInterval: 300 } });

    expect(config.workingCopies).toEqual({ idleTimeout: 900, sweepInterval: 300 });
  });

  it('treats an idle period of zero as reaping disabled', () => {
    const { config, errors } = validateConfig({ ...legacy, workingCopies: { idleTimeout: 0 } });

    expect(errors).toEqual([]);
    expect(config!.workingCopies.idleTimeout).toBe(0);
  });

  it('refuses a nonsensical period at startup rather than at the first sweep', () => {
    expect(validateConfig({ ...legacy, workingCopies: { idleTimeout: -1 } }).config).toBeNull();
    expect(validateConfig({ ...legacy, workingCopies: { idleTimeout: 1.5 } }).config).toBeNull();
    expect(validateConfig({ ...legacy, workingCopies: { idleTimeout: 'never' } }).config).toBeNull();
    // Reaping on with no sweep would silently never run.
    expect(
      validateConfig({ ...legacy, workingCopies: { idleTimeout: 600, sweepInterval: 0 } }).config,
    ).toBeNull();
  });
});
