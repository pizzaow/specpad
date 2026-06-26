import { describe, it, expect } from 'vitest';
import { buildAuditReport } from '../auditReport';
import type { PrdDoc, SrsDoc, VtpDoc } from '../shared';

const prd: PrdDoc = {
  schemaVersion: '1.0', type: 'prd', name: 'Acme', title: 'PRD',
  items: [
    { id: 'p_a', code: 'PROD-1', text: 'Built need.', status: 'implemented' },
    { id: 'p_b', code: 'PROD-2', text: 'Roadmap need.', status: 'proposed' },
  ],
};

const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'Acme', title: 'SRS',
  items: [
    { id: 'h_0', heading: true, text: 'Section' },
    { id: 'r_1', code: 'R-1', text: 'Verified req.', satisfies: ['p_a'] },
    { id: 'r_2', code: 'R-2', text: 'Unverified req.' },
  ],
};

const vtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'Acme', title: 'VTP',
  items: [
    { id: 't_1', code: 'T-1', text: 'Test r_1', verifies: ['r_1'], expected: 'works', result: 'passed' },
  ],
};

describe('buildAuditReport', () => {
  it('computes requirement, test, and PRD coverage', () => {
    const r = buildAuditReport({ prd, srs, vtp });
    expect(r.coverage.requirements).toEqual({ total: 2, verified: 1 });
    expect(r.coverage.tests.passed).toBe(1);
    expect(r.coverage.tests.total).toBe(1);
    expect(r.coverage.productRequirements).toMatchObject({ total: 2, implemented: 1, implementedSatisfied: 1, proposed: 1 });
    expect(r.hasPrd).toBe(true);
  });

  it('builds one trace row per non-heading requirement, resolving PRDs and tests', () => {
    const r = buildAuditReport({ prd, srs, vtp });
    expect(r.trace.map((t) => t.req.id)).toEqual(['r_1', 'r_2']);
    const row1 = r.trace.find((t) => t.req.id === 'r_1')!;
    expect(row1.prds.map((p) => p.code)).toEqual(['PROD-1']);
    expect(row1.tests.map((t) => t.code)).toEqual(['T-1']);
    expect(row1.rollup).toBe('passed');
  });

  it('rolls up an unverified requirement as no_test', () => {
    const r = buildAuditReport({ prd, srs, vtp });
    expect(r.trace.find((t) => t.req.id === 'r_2')!.rollup).toBe('no_test');
  });

  it('rolls up failed over passed, and flags dangling PRD references', () => {
    const srs2: SrsDoc = { ...srs, items: [{ id: 'r_3', text: 'X', satisfies: ['p_missing'] }] };
    const vtp2: VtpDoc = { ...vtp, items: [
      { id: 't_2', text: 'pass', verifies: ['r_3'], expected: 'e', result: 'passed' },
      { id: 't_3', text: 'fail', verifies: ['r_3'], expected: 'e', result: 'failed' },
    ] };
    const r = buildAuditReport({ prd, srs: srs2, vtp: vtp2 });
    const row = r.trace[0];
    expect(row.rollup).toBe('failed');
    expect(row.danglingPrdRefs).toEqual(['p_missing']);
  });

  it('surfaces governance violations and the proposed-PRD roadmap', () => {
    const r = buildAuditReport({ prd, srs, vtp });
    // r_2 is unverified → a traceability violation is surfaced.
    expect(r.violations.some((v) => v.rule === 'traceability' && v.itemId === 'r_2')).toBe(true);
    expect(r.roadmap.map((p) => p.code)).toEqual(['PROD-2']);
  });

  it('works with no PRD register (requirement→test only)', () => {
    const r = buildAuditReport({ srs, vtp });
    expect(r.hasPrd).toBe(false);
    expect(r.trace[0].prds).toEqual([]);
    expect(r.coverage.productRequirements.total).toBe(0);
  });

  it('derives an automated test result from the run, not a stored field (VER-8)', () => {
    const autoVtp: VtpDoc = {
      schemaVersion: '1.0', type: 'vtp', name: 'Acme', title: 'VTP',
      items: [{ id: 't_a', code: 'T-A', text: 'Auto', verifies: ['r_1'], expected: 'e', automation: [{ runner: 'vitest', file: 'a.test.ts' }] }],
    };
    // No run loaded → the automated test is "not run", not passing.
    expect(buildAuditReport({ srs, vtp: autoVtp }).coverage.tests.passed).toBe(0);
    expect(buildAuditReport({ srs, vtp: autoVtp }).trace.find((t) => t.req.id === 'r_1')!.rollup).toBe('not_tested');
    // With a passing run → derived as passed.
    const run = { schemaVersion: '1.0' as const, type: 'run' as const, name: 'Acme', runner: 'vitest', ref: 'abc', ranAt: '2026-06-26',
      summary: { total: 1, passed: 1, failed: 0, skipped: 0 }, results: [{ file: 'a.test.ts', selector: 'x', status: 'passed' as const }] };
    const r = buildAuditReport({ srs, vtp: autoVtp }, run);
    expect(r.coverage.tests.passed).toBe(1);
    expect(r.trace.find((t) => t.req.id === 'r_1')!.rollup).toBe('passed');
  });
});
