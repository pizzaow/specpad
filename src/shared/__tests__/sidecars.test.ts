import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import type { ReleasesDoc, JobDoc, AttributionDoc } from '../schema';

const releases: ReleasesDoc = {
  schemaVersion: '1.0',
  type: 'releases',
  name: 'AcmeApp',
  tagPattern: 'v*',
  baseline: 'v26.1',
  releases: [
    { version: 'v24.0', ref: 'v24.0', date: '2025-11-02', snapshot: null },
    { version: 'v26.1', ref: 'v26.1', date: '2026-05-30', snapshot: '.specpad/baseline' },
  ],
};

const job: JobDoc = { schemaVersion: '1.0', type: 'job', job: 'PROJ-123', title: 'Add SSO' };

const attribution: AttributionDoc = {
  schemaVersion: '1.0',
  type: 'attribution',
  items: {
    r_7f3a9c: {
      addedIn: 'v24.0',
      addedBy: { name: 'Geoff Pollard', email: 'geoff@example.com' },
      lastChangedIn: 'v26.1',
      lastChangedBy: { name: 'Sam Lee', email: 'sam@example.com' },
    },
  },
};

describe('sidecar schemas', () => {
  it('accepts a well-formed releases doc', () => {
    expect(validate(releases)).toEqual([]);
  });

  it('accepts baseline: null (no releases yet)', () => {
    expect(validate({ ...releases, baseline: null, releases: [] })).toEqual([]);
  });

  it('rejects a releases doc missing tagPattern', () => {
    const { tagPattern: _tagPattern, ...bad } = releases;
    expect(validate(bad).length).toBeGreaterThan(0);
  });

  it('accepts a well-formed job doc and one without a title', () => {
    expect(validate(job)).toEqual([]);
    expect(validate({ schemaVersion: '1.0', type: 'job', job: 'PROJ-9' })).toEqual([]);
  });

  it('rejects a job doc missing the job id', () => {
    expect(validate({ schemaVersion: '1.0', type: 'job', title: 'x' }).length).toBeGreaterThan(0);
  });

  it('accepts a well-formed attribution doc', () => {
    expect(validate(attribution)).toEqual([]);
  });

  it('rejects an attribution entry with a non-object author', () => {
    const bad = {
      ...attribution,
      items: { r_1: { addedIn: 'v1', addedBy: 'Geoff', lastChangedIn: 'v1', lastChangedBy: 'Geoff' } },
    };
    expect(validate(bad).length).toBeGreaterThan(0);
  });
});
