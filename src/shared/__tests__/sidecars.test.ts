import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import { jobsSchema } from '../schema';
import type { ReleasesDoc, JobDoc, JobsDoc } from '../schema';

const releases: ReleasesDoc = {
  schemaVersion: '1.0',
  type: 'releases',
  name: 'AcmeApp',
  tagPattern: 'v*',
  baseline: 'v26.1',
  releases: [
    {
      version: 'v24.0',
      ref: 'v24.0',
      date: '2025-11-02',
      author: { name: 'Geoff Pollard', email: 'geoff@example.com' },
      snapshot: null,
    },
    {
      version: 'v26.1',
      ref: 'v26.1',
      date: '2026-05-30',
      author: { name: 'Sam Lee', email: 'sam@example.com' },
      snapshot: '.specpad/baseline',
    },
  ],
};

const job: JobDoc = { schemaVersion: '1.0', type: 'job', job: 'PROJ-123', title: 'Add SSO' };

const jobs: JobsDoc = {
  schemaVersion: '1.0',
  type: 'jobs',
  name: 'AcmeApp',
  jobs: [
    { id: 'j_a1b2c3', code: 'JOB-1', title: 'Add jobs list', description: 'A register.', status: 'open' },
    { id: 'j_d4e5f6', title: 'Closed work', status: 'closed' },
  ],
};

describe('sidecar schemas', () => {
  it('accepts a well-formed releases doc (with per-release author)', () => {
    expect(validate(releases)).toEqual([]);
  });

  it('accepts baseline: null with no releases yet', () => {
    expect(validate({ ...releases, baseline: null, releases: [] })).toEqual([]);
  });

  it('rejects a releases doc missing tagPattern', () => {
    const bad: Record<string, unknown> = { ...releases };
    delete bad.tagPattern;
    expect(validate(bad).length).toBeGreaterThan(0);
  });

  it('rejects a release entry missing author', () => {
    const bad = {
      ...releases,
      releases: [{ version: 'v1', ref: 'v1', date: '2025-01-01', snapshot: null }],
    };
    expect(validate(bad).length).toBeGreaterThan(0);
  });

  it('rejects a release entry whose author is not an object', () => {
    const bad = {
      ...releases,
      releases: [
        { version: 'v1', ref: 'v1', date: '2025-01-01', author: 'Geoff', snapshot: null },
      ],
    };
    expect(validate(bad).length).toBeGreaterThan(0);
  });

  it('accepts the marker in legacy single, multi, and empty forms', () => {
    expect(validate(job)).toEqual([]); // legacy { job: 'PROJ-123' }
    expect(validate({ schemaVersion: '1.0', type: 'job', jobs: ['j_a1b2c3', 'j_d4e5f6'] })).toEqual([]);
    expect(validate({ schemaVersion: '1.0', type: 'job', jobs: [] })).toEqual([]);
    expect(validate({ schemaVersion: '1.0', type: 'job' })).toEqual([]);
  });

  it('rejects a marker whose jobs entries are not strings', () => {
    expect(validate({ schemaVersion: '1.0', type: 'job', jobs: [1, 2] }).length).toBeGreaterThan(0);
  });

  it('accepts a well-formed jobs register (with and without optional fields)', () => {
    expect(validate(jobs)).toEqual([]);
  });

  it('a job record stores only record fields — no change associations (r_jb002)', () => {
    const keys = Object.keys((jobsSchema as any).properties.jobs.items.properties).sort();
    expect(keys).toEqual(['code', 'description', 'id', 'owner', 'status', 'title', 'type', 'version']);
  });

  it('accepts a job record with type/version/owner and rejects a bad type', () => {
    const withMeta = { ...jobs, jobs: [{ id: 'j_x', code: 'JOB-9', type: 'bugfix', version: '1.2', owner: { name: 'A', email: 'a@b' }, title: 'Fix', status: 'open' }] };
    expect(validate(withMeta)).toEqual([]);
    const badType = { ...jobs, jobs: [{ id: 'j_x', type: 'chore', title: 'Bad', status: 'open' }] };
    expect(validate(badType).length).toBeGreaterThan(0);
  });

  it('rejects a job record missing a status', () => {
    const bad = { ...jobs, jobs: [{ id: 'j_x', title: 'No status' }] };
    expect(validate(bad).length).toBeGreaterThan(0);
  });

  it('rejects a job record whose status is outside the enum', () => {
    const bad = { ...jobs, jobs: [{ id: 'j_x', title: 'Bad', status: 'in-review' }] };
    expect(validate(bad).length).toBeGreaterThan(0);
  });

  it('rejects a jobs register missing the jobs array', () => {
    const bad: Record<string, unknown> = { ...jobs };
    delete bad.jobs;
    expect(validate(bad).length).toBeGreaterThan(0);
  });

  it('no longer recognizes the removed attribution type', () => {
    const errs = validate({ schemaVersion: '1.0', type: 'attribution', items: {} });
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0].message).toContain('Unknown document type');
  });
});
