import { describe, it, expect } from 'vitest';
import { checkGovernance, GOVERNANCE_RULES } from '../governance';
import type { SrsDoc, VtpDoc, JobsDoc, JobDoc } from '../schema';

const srs: SrsDoc = {
  schemaVersion: '1.0',
  type: 'srs',
  name: 'AcmeApp',
  title: 'Requirements',
  items: [
    { id: 'h_001', heading: true, text: 'Functional' },
    { id: 'r_001', text: 'Shall authenticate users.' },
    { id: 'r_002', text: 'Shall log out users.' },
  ],
};

function vtp(items: VtpDoc['items']): VtpDoc {
  return { schemaVersion: '1.0', type: 'vtp', name: 'AcmeApp', title: 'Tests', items };
}

describe('checkGovernance', () => {
  it('passes a fully-traceable, well-formed bundle', () => {
    const bundle = {
      srs,
      vtp: vtp([
        { id: 't_001', text: 'Login', verifies: ['r_001'], expected: 'Authenticated.' },
        { id: 't_002', text: 'Logout', verifies: ['r_002'], expected: 'Logged out.' },
      ]),
    };
    expect(checkGovernance(bundle)).toEqual([]);
  });

  it('flags a requirement with no verifying test (traceability)', () => {
    const bundle = {
      srs,
      vtp: vtp([{ id: 't_001', text: 'Login', verifies: ['r_001'], expected: 'OK.' }]),
    };
    const v = checkGovernance(bundle);
    expect(v.some((x) => x.rule === 'traceability' && x.itemId === 'r_002')).toBe(true);
  });

  it('does NOT require headings to be tested', () => {
    const bundle = {
      srs,
      vtp: vtp([
        { id: 't_001', text: 'Login', verifies: ['r_001'], expected: 'OK.' },
        { id: 't_002', text: 'Logout', verifies: ['r_002'], expected: 'OK.' },
      ]),
    };
    expect(checkGovernance(bundle).some((x) => x.itemId === 'h_001')).toBe(false);
  });

  it('flags a dangling verifies reference (referential-integrity)', () => {
    const bundle = {
      srs,
      vtp: vtp([
        { id: 't_001', text: 'Login', verifies: ['r_001'], expected: 'OK.' },
        { id: 't_002', text: 'Logout', verifies: ['r_999'], expected: 'OK.' },
      ]),
    };
    const v = checkGovernance(bundle);
    expect(v.some((x) => x.rule === 'referential-integrity' && x.itemId === 't_002')).toBe(true);
  });

  it('flags a non-heading test with empty expected (missing-expected)', () => {
    const bundle = {
      srs,
      vtp: vtp([
        { id: 't_001', text: 'Login', verifies: ['r_001'], expected: 'OK.' },
        { id: 't_002', text: 'Logout', verifies: ['r_002'], expected: '' },
      ]),
    };
    const v = checkGovernance(bundle);
    expect(v.some((x) => x.rule === 'missing-expected' && x.itemId === 't_002')).toBe(true);
  });

  const jobs: JobsDoc = {
    schemaVersion: '1.0',
    type: 'jobs',
    name: 'AcmeApp',
    jobs: [
      { id: 'j_open', code: 'JOB-1', title: 'Open work', status: 'open' },
      { id: 'j_closed', code: 'JOB-2', title: 'Closed work', status: 'closed' },
    ],
  };
  function job(id: string): JobDoc {
    return { schemaVersion: '1.0', type: 'job', job: id };
  }

  it('flags an active job that is closed (active-job-open)', () => {
    const v = checkGovernance({ jobs, job: job('j_closed') });
    expect(v.some((x) => x.rule === 'active-job-open' && x.itemId === 'j_closed')).toBe(true);
  });

  it('does not flag an active job that is open', () => {
    expect(checkGovernance({ jobs, job: job('j_open') })).toEqual([]);
  });

  it('does not flag when there is no active job or no register', () => {
    expect(checkGovernance({ jobs })).toEqual([]);
    expect(checkGovernance({ job: job('j_closed') })).toEqual([]);
  });

  it('does not flag when the active id matches no record', () => {
    expect(checkGovernance({ jobs, job: job('j_missing') })).toEqual([]);
  });

  it('exposes a stable list of rule ids', () => {
    expect(GOVERNANCE_RULES.map((r) => r.id).sort()).toEqual([
      'active-job-open', 'missing-expected', 'referential-integrity', 'traceability',
    ]);
  });
});
