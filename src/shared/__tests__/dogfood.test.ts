import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import { checkGovernance, activeJobIds } from '../governance';
import proj from '../../../docs/specpad/specpad.proj.json';
import srs from '../../../docs/specpad/specpad.srs.json';
import vtp from '../../../docs/specpad/specpad.vtp.json';
import releases from '../../../docs/specpad/specpad.releases.json';
import job from '../../../docs/specpad/specpad.job.json';
import jobs from '../../../docs/specpad/specpad.jobs.json';
import type { SrsDoc, VtpDoc, JobsDoc, JobDoc } from '../schema';

// SpecPad documents its own requirements and tests with SpecPad (dogfooding).
// These must stay structurally valid and governance-clean, exactly like any
// project the skill or editor governs.
describe('SpecPad self-documentation (dogfood)', () => {
  it('passes structural validation for every document', () => {
    expect(validate(proj)).toEqual([]);
    expect(validate(srs)).toEqual([]);
    expect(validate(vtp)).toEqual([]);
    expect(validate(releases)).toEqual([]);
    expect(validate(job)).toEqual([]);
    expect(validate(jobs)).toEqual([]);
  });

  it('passes governance with no violations', () => {
    expect(
      checkGovernance({
        srs: srs as SrsDoc,
        vtp: vtp as VtpDoc,
        jobs: jobs as JobsDoc,
        job: job as JobDoc,
      }),
    ).toEqual([]);
  });

  it('keeps every active job pointed at an open record in the register', () => {
    const ids = activeJobIds(job as JobDoc);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const active = (jobs as JobsDoc).jobs.find((j) => j.id === id);
      expect(active, `active id ${id} resolves`).toBeDefined();
      expect(active!.status).toBe('open');
    }
  });
});
