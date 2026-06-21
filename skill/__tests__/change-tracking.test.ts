// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validate } from '../../src/shared/validate';

const skill = readFileSync(new URL('../specpad/SKILL.md', import.meta.url), 'utf8');
const template = readFileSync(
  new URL('../specpad/templates/starter.releases.json', import.meta.url),
  'utf8',
);

describe('skill documents the change-tracking plumbing', () => {
  it('documents the manifest, cache dir, and job marker files', () => {
    expect(skill).toContain('.releases.json');
    expect(skill).toContain('.specpad/');
    expect(skill).toContain('.job.json');
  });

  it('documents the core plumbing operations', () => {
    expect(skill).toMatch(/refresh/i);
    expect(skill).toMatch(/snapshot/i);
    expect(skill).toContain('Job:'); // the commit trailer
  });

  it('states the skill never computes diffs (the editor does)', () => {
    expect(skill.toLowerCase()).toContain('never');
    expect(skill).toMatch(/editor (computes|owns|diffs)/i);
  });

  it('documents the closed-job cache, derived version, and owner-from-git', () => {
    expect(skill).toMatch(/\.specpad\/jobs\//);          // closed-job before/after cache
    expect(skill).toMatch(/On close/i);                   // cache written on close
    expect(skill).toMatch(/version is derived/i);         // version not hand-set
    expect(skill).toMatch(/git tag --contains/);          // derivation mechanism
    expect(skill).toMatch(/owner.*from git|set `owner`/i); // owner set from git
  });

  it('documents the source-traceability export (job → commits → code) and the commits cache', () => {
    expect(skill).toMatch(/Source-traceability export/i);
    expect(skill).toMatch(/commits\.json/);
    expect(skill).toMatch(/git log --grep/);
  });
});

describe('dogfood job caches', () => {
  const jobsDir = fileURLToPath(new URL('../../docs/specpad/.specpad/jobs/', import.meta.url));
  const root = (f: string) => fileURLToPath(new URL(`../../docs/specpad/${f}`, import.meta.url));
  const statusById = new Map<string, string>(
    JSON.parse(readFileSync(root('specpad.jobs.json'), 'utf8')).jobs.map((j: any) => [j.id, j.status]),
  );

  it('caches a before snapshot for every job, and before+after+commits for closed jobs', () => {
    expect(existsSync(jobsDir)).toBe(true);
    const ids = readdirSync(jobsDir);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      // every cached job has a `before` snapshot (written at create) that validates
      const beforeSrs = JSON.parse(readFileSync(`${jobsDir}${id}/before/specpad.srs.json`, 'utf8'));
      expect(validate(beforeSrs), `${id} before`).toEqual([]);
      if (statusById.get(id) !== 'closed') continue; // open jobs have only a before
      const afterSrs = JSON.parse(readFileSync(`${jobsDir}${id}/after/specpad.srs.json`, 'utf8'));
      expect(validate(afterSrs), `${id} after`).toEqual([]);
      const commits = JSON.parse(readFileSync(`${jobsDir}${id}/commits.json`, 'utf8'));
      expect(Array.isArray(commits) && commits.length > 0, `${id} commits`).toBe(true);
      expect(commits[0]).toHaveProperty('hash');
      for (const state of ['before', 'after']) {
        expect(Array.isArray(JSON.parse(readFileSync(`${jobsDir}${id}/${state}/arch-files.json`, 'utf8')))).toBe(true);
      }
    }
  });

  it('snapshots a job\'s before at creation, so the active open job has one', () => {
    expect(skill).toMatch(/On create/i);                       // documented: before written at create
    expect(skill).toMatch(/in-progress changes/i);             // open-job in-progress diff
    const active = JSON.parse(readFileSync(root('specpad.job.json'), 'utf8'));
    const id = (active.jobs ?? [active.job]).filter(Boolean)[0];
    const beforeSrs = JSON.parse(readFileSync(`${jobsDir}${id}/before/specpad.srs.json`, 'utf8'));
    expect(validate(beforeSrs)).toEqual([]);
  });

  it('a release is a full-doc checkpoint that maps to its jobs', () => {
    const root = (f: string) => fileURLToPath(new URL(`../../docs/specpad/${f}`, import.meta.url));
    const releases = JSON.parse(readFileSync(root('specpad.releases.json'), 'utf8'));
    const jobs = JSON.parse(readFileSync(root('specpad.jobs.json'), 'utf8'));
    // v1.2 release exists and closed jobs map to it via job.version
    expect(releases.releases.map((r: any) => r.version)).toContain('v1.2');
    expect(jobs.jobs.some((j: any) => j.version === 'v1.2' && j.status === 'closed')).toBe(true);
    // the baseline snapshot is a FULL doc set (not just the spec JSON)
    const base = (f: string) => existsSync(root(`.specpad/baseline/${f}`));
    expect(base('specpad.srs.json')).toBe(true);
    expect(base('specpad.sad.md')).toBe(true);
    expect(base('specpad.context.svg')).toBe(true);
    expect(skill).toMatch(/all key\s+documents/i);
  });

  it('captures the architecture file change for the job that created the SAD', () => {
    const job = fileURLToPath(new URL('../../docs/specpad/.specpad/jobs/j_e7a2b1/', import.meta.url));
    const before = JSON.parse(readFileSync(`${job}before/arch-files.json`, 'utf8'));
    const after = JSON.parse(readFileSync(`${job}after/arch-files.json`, 'utf8'));
    expect(before).toEqual([]);                       // SAD did not exist before JOB-9
    expect(after).toContain('specpad.sad.md');        // JOB-9 added it
  });
});

describe('starter releases template', () => {
  it('is valid JSON that passes the shared releases schema', () => {
    const doc = JSON.parse(template);
    expect(doc.type).toBe('releases');
    expect(doc.schemaVersion).toBe('1.0');
    expect(validate(doc)).toEqual([]);
  });
});

describe('skill documents requirement hierarchy', () => {
  it('documents the level field and dotted heading codes', () => {
    expect(skill).toMatch(/level/);
    expect(skill).toMatch(/hierarch/i);
    expect(skill).toContain('Data.Range');
  });
});
