import { describe, it, expect } from 'vitest';
import { verificationOutcome, linkOutcome, rollup } from '../verification';
import { validate } from '../validate';
import type { VtpItem, RunRecord } from '../schema';

const run: RunRecord = {
  schemaVersion: '1.0', type: 'run', name: 'Acme', runner: 'vitest', ref: 'abc1234', ranAt: '2026-06-25',
  summary: { total: 4, passed: 2, failed: 1, skipped: 1 },
  results: [
    { file: 'a.test.ts', selector: 'logs in', status: 'passed' },
    { file: 'a.test.ts', selector: 'logs out', status: 'passed' },
    { file: 'b.test.ts', selector: 'boom', status: 'failed' },
    { file: 'c.test.ts', selector: 'later', status: 'skipped' },
  ],
};

const item = (over: Partial<VtpItem>): VtpItem => ({ id: 't_1', text: 'x', ...over });

describe('verification — link matching', () => {
  it('matches a file-level link to every result in that file (passes only if all pass)', () => {
    expect(linkOutcome({ runner: 'vitest', file: 'a.test.ts' }, run).status).toBe('passed');
    expect(linkOutcome({ runner: 'vitest', file: 'b.test.ts' }, run).status).toBe('failed');
  });
  it('matches a selector-pinned link to the one test', () => {
    expect(linkOutcome({ runner: 'vitest', file: 'a.test.ts', selector: 'logs in' }, run).status).toBe('passed');
  });
  it('reports missing when the link resolves to no result', () => {
    expect(linkOutcome({ runner: 'vitest', file: 'gone.test.ts' }, run).status).toBe('missing');
    expect(linkOutcome({ runner: 'vitest', file: 'a.test.ts', selector: 'nope' }, run).status).toBe('missing');
  });
});

describe('verification — test outcome', () => {
  it('derives an automated test result from the run, not the stored result field', () => {
    const o = verificationOutcome(item({ automation: [{ runner: 'vitest', file: 'a.test.ts' }], result: 'failed' }), run);
    expect(o.automated).toBe(true);
    expect(o.status).toBe('passed'); // run wins over the stale stored 'failed'
    expect(o.run).toEqual({ runner: 'vitest', ref: 'abc1234', ranAt: '2026-06-25' });
  });
  it('fails if any link failed; not_run if any link is missing', () => {
    expect(verificationOutcome(item({ automation: [{ runner: 'vitest', file: 'a.test.ts' }, { runner: 'vitest', file: 'b.test.ts' }] }), run).status).toBe('failed');
    expect(verificationOutcome(item({ automation: [{ runner: 'vitest', file: 'a.test.ts' }, { runner: 'vitest', file: 'gone.test.ts' }] }), run).status).toBe('not_run');
  });
  it('automated test with no run loaded is not_run', () => {
    expect(verificationOutcome(item({ automation: [{ runner: 'vitest', file: 'a.test.ts' }] }), null).status).toBe('not_run');
  });
  it('a manual test falls back to its stored result', () => {
    expect(verificationOutcome(item({ result: 'passed' }), run).status).toBe('passed');
    expect(verificationOutcome(item({}), run).status).toBe('unset');
    expect(verificationOutcome(item({ result: 'passed' }), run).automated).toBe(false);
  });
});

describe('verification — rollup + run schema', () => {
  it('counts non-heading tests by status and automated/manual', () => {
    const items: VtpItem[] = [
      { id: 'h', heading: true, text: 'H' },
      item({ id: 't_a', automation: [{ runner: 'vitest', file: 'a.test.ts' }] }), // passed
      item({ id: 't_b', automation: [{ runner: 'vitest', file: 'b.test.ts' }] }), // failed
      item({ id: 't_m', result: 'passed' }), // manual passed
    ];
    const r = rollup(items, run);
    expect(r.passed).toBe(2);
    expect(r.failed).toBe(1);
    expect(r.automated).toBe(2);
    expect(r.manual).toBe(1);
  });
  it('a RunRecord validates as a sidecar', () => {
    expect(validate(run)).toEqual([]);
    expect(validate({ ...run, summary: { total: 1 } })).not.toEqual([]); // missing required counts
  });
  it('a VtpItem with automation validates', () => {
    const doc = { schemaVersion: '1.0', type: 'vtp', name: 'Acme', title: 'T', items: [item({ automation: [{ runner: 'vitest', file: 'a.test.ts', selector: 'logs in' }] })] };
    expect(validate(doc)).toEqual([]);
  });
});
