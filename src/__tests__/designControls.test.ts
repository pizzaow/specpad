import { describe, it, expect } from 'vitest';
import { buildDesignControls } from '../designControls';
import type { SrsDoc, VtpDoc, ReleasesDoc, JobRecord } from '../shared';

const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'Acme', title: 'SRS',
  items: [
    { id: 'r_1', code: 'R-1', text: 'Verified.' },
    { id: 'r_2', code: 'R-2', text: 'Unverified.' },
  ],
};
const vtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'Acme', title: 'VTP',
  items: [{ id: 't_1', text: 'Test', verifies: ['r_1'], expected: 'ok', result: 'passed' }],
};
const releases: ReleasesDoc = {
  schemaVersion: '1.0', type: 'releases', name: 'Acme', tagPattern: 'v*', baseline: 'v1',
  releases: [{ version: 'v1', ref: 'a', date: '2026-01-01', author: { name: 'G', email: 'g@x' }, snapshot: null }],
};
const jobs: JobRecord[] = [{ id: 'j1', code: 'JOB-1', title: 'Work', status: 'open' }];

const byKey = (els: ReturnType<typeof buildDesignControls>, k: string) => els.find((e) => e.key === k)!;

describe('buildDesignControls', () => {
  it('lists the formal elements, each with a citation and statement', () => {
    const els = buildDesignControls({ srs, vtp, jobs, releases, hasArchitecture: true });
    expect(els.map((e) => e.key)).toEqual([
      'inputs', 'outputs', 'verification', 'validation', 'traceability',
      'changes', 'dhf', 'reviews', 'risk', 'config',
    ]);
    for (const el of els) {
      expect(el.cite, `${el.key} cite`).toBeTruthy();
      expect(el.statement, `${el.key} statement`).toBeTruthy();
    }
    expect(byKey(els, 'inputs').cite).toMatch(/62304|820\.30/);
  });

  it('derives status from the project', () => {
    const els = buildDesignControls({ srs, vtp, jobs, releases, hasArchitecture: true });
    expect(byKey(els, 'inputs').status).toBe('present'); // requirements exist
    expect(byKey(els, 'verification').status).toBe('partial'); // 1 of 2 verified
    expect(byKey(els, 'changes').status).toBe('present'); // a job exists
    expect(byKey(els, 'dhf').status).toBe('present'); // a release exists
    expect(byKey(els, 'validation').status).toBe('gap'); // not built
    expect(byKey(els, 'risk').status).toBe('gap'); // not built
  });

  it('marks gaps when the project is empty', () => {
    const els = buildDesignControls({ srs: null, vtp: null, jobs: [], releases: null, hasArchitecture: false });
    expect(byKey(els, 'inputs').status).toBe('gap');
    expect(byKey(els, 'outputs').status).toBe('gap');
    expect(byKey(els, 'changes').status).toBe('gap');
  });

  it('links elements to the tab holding their evidence', () => {
    const els = buildDesignControls({ srs, vtp, jobs, releases, hasArchitecture: true });
    expect(byKey(els, 'inputs').link).toBe('srs');
    expect(byKey(els, 'verification').link).toBe('vtp');
    expect(byKey(els, 'traceability').link).toBe('trace');
    expect(byKey(els, 'changes').link).toBe('jobs');
    expect(byKey(els, 'dhf').link).toBe('releases');
    expect(byKey(els, 'validation').link).toBeUndefined();
  });
});
