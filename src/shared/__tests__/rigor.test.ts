import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import { checkGovernance, checkAdvice } from '../governance';
import type { RiskDoc, SddDoc, ReleasesDoc, SrsDoc, VtpDoc } from '../schema';

/**
 * The fields that carry detail 62304 asks for and prose could not hold (JOB-56, slice 2).
 *
 * Each of these already existed in careful projects, written into a body paragraph. The
 * point of promoting them to fields is that a paragraph cannot be rolled up, governed, or
 * shown to a reviewer — which is how "we do that" and "we can prove we do that" came apart.
 */

const sdd = (over: Partial<SddDoc['items'][number]> = {}): SddDoc => ({
  schemaVersion: '1.0', type: 'sdd', name: 'Acme', title: 'Design',
  items: [
    { id: 'd_1', code: 'SDD-1', title: 'Dose calculator', kind: 'unit', acceptance: 'Rejects a rate outside 0.1–99 mL/h and returns the prior value.', ...over },
    { id: 'd_2', code: 'SDD-2', title: 'Logging', kind: 'unit', acceptance: 'Every entry carries a monotonic timestamp.' },
    { id: 'd_v', code: 'SDD-9', title: 'Dependency view', kind: 'view' },
  ],
});
const risk = (over: Partial<RiskDoc['items'][number]> = {}): RiskDoc => ({
  schemaVersion: '1.0', type: 'risk', name: 'Acme', title: 'Risk',
  items: [
    { id: 'h_1', text: 'Dosing', heading: true },
    {
      id: 'k_1', code: 'RISK-1', text: 'An overdose is delivered.',
      sequence: 'The rate is mis-parsed, no range check rejects it, the pump accepts it, and infusion proceeds at the wrong rate.',
      causes: ['d_1'], controls: ['r_1'], ...over,
    },
  ],
});
const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'Acme', title: 'Requirements',
  items: [{ id: 'r_1', code: 'A-1', text: 'The rate shall be range-checked.', design: ['d_1'], category: ['functional'] }],
};
const vtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'Acme', title: 'Tests',
  items: [{ id: 't_1', text: 'Enter 200 mL/h.', verifies: ['r_1'], expected: 'Refused.', verificationLevel: 'unit' }],
};

const only = (v: { rule: string; message: string }[], p: string) => v.filter((x) => x.rule.startsWith(p));

describe('unit acceptance criteria (§5.5.3)', () => {
  it('advises on a unit that does not say what verified means', () => {
    const advice = checkAdvice({ sdd: sdd({ acceptance: undefined }) });
    expect(advice.filter((a) => a.rule === 'sdd-acceptance').map((a) => a.itemId)).toEqual(['d_1']);
  });

  it('does not ask it of a design view, which is not something "verified" applies to', () => {
    expect(checkAdvice({ sdd: sdd() }).some((a) => a.itemId === 'd_v')).toBe(false);
  });

  it('blocks once the project adopts the rule', () => {
    const bundle = { sdd: sdd({ acceptance: '   ' }), project: { schemaVersion: '1.0', type: 'project', name: 'Acme', title: 'Acme', documents: [], enforce: ['sdd-acceptance'] } as never };
    expect(checkGovernance(bundle).map((v) => v.rule)).toContain('sdd-acceptance');
  });
});

describe('segregation for risk control (§5.3.5)', () => {
  it('says nothing when no section claims segregation', () => {
    expect(only(checkGovernance({ sdd: sdd() }), 'sdd-segregation')).toEqual([]);
  });

  it('requires a rationale from a section that claims it — intended is not ensured', () => {
    const doc = sdd({ segregatedFrom: ['d_2'] });
    expect(only(checkGovernance({ sdd: doc }), 'sdd-segregation').map((v) => v.message))
      .toEqual([expect.stringContaining('does not say why it is effective')]);
  });

  it('accepts a claim with a rationale, and rejects one naming an unknown section', () => {
    expect(only(checkGovernance({ sdd: sdd({ segregatedFrom: ['d_2'], segregationRationale: 'Separate OS processes; no shared memory.' }) }), 'sdd-segregation')).toEqual([]);
    expect(only(checkGovernance({ sdd: sdd({ segregatedFrom: ['d_gone'], segregationRationale: 'x' }) }), 'sdd-segregation')).toHaveLength(1);
  });
});

describe('sequence of events (§7.1.5)', () => {
  it('advises on a risk that records only the endpoint', () => {
    const advice = checkAdvice({ risk: risk({ sequence: undefined }), sdd: sdd(), srs, vtp });
    expect(advice.filter((a) => a.rule === 'risk-sequence').map((a) => a.itemId)).toEqual(['k_1']);
  });

  it('is silent when the sequence is recorded, and never asks it of a heading', () => {
    const advice = checkAdvice({ risk: risk(), sdd: sdd(), srs, vtp });
    expect(advice.some((a) => a.rule === 'risk-sequence')).toBe(false);
    expect(advice.some((a) => a.itemId === 'h_1')).toBe(false);
  });
});

describe('release records (§5.8.2, §5.8.3, §5.8.5, §5.8.8)', () => {
  const releases = (over = {}): ReleasesDoc => ({
    schemaVersion: '1.0', type: 'releases', name: 'Acme', tagPattern: 'v*', baseline: 'v1.0',
    releases: [{
      version: 'v1.0', ref: 'abc123', date: '2026-08-12',
      author: { name: 'A', email: 'a@example.com' }, snapshot: null,
      anomalies: [{ text: 'The export omits the final row when the list is empty.', evaluation: 'No safety impact; the empty case shows a warning.', ref: 'ACME-441' }],
      build: 'Node 22.4.0, npm 10.8, Ubuntu 24.04 runner; procedure in SOP-030.',
      ...over,
    }],
  });

  it('accepts a release recording its known defects and how it was built', () => {
    expect(validate(releases())).toEqual([]);
  });

  it('requires an anomaly to say what it is, but not how it was judged', () => {
    // The evaluation is 5.8.3 and can lag; the defect itself cannot be nameless.
    expect(validate(releases({ anomalies: [{ evaluation: 'Fine.' }] })).length).toBeGreaterThan(0);
    expect(validate(releases({ anomalies: [{ text: 'A known defect.' }] }))).toEqual([]);
  });

  it('accepts a release with neither, because both are absent on older entries', () => {
    expect(validate(releases({ anomalies: undefined, build: undefined }))).toEqual([]);
  });
});

describe('verification depth — one requirement is not one test', () => {
  const srsOne: SrsDoc = {
    schemaVersion: '1.0', type: 'srs', name: 'A', title: 'SRS',
    items: [
      { id: 'r_1', code: 'A-1', text: 'The rate shall be range-checked.' },
      { id: 'r_2', code: 'A-2', text: 'The log shall be append-only.' },
    ],
  };

  it('advises on a requirement proven only on the happy path', () => {
    const vtpDoc: VtpDoc = {
      schemaVersion: '1.0', type: 'vtp', name: 'A', title: 'VTP',
      items: [
        { id: 't_1', text: 'Enter 20.', verifies: ['r_1'], expected: 'Accepted.', kind: 'nominal' },
        { id: 't_2', text: 'Append.', verifies: ['r_2'], expected: 'Appended.', kind: 'nominal' },
        { id: 't_3', text: 'Rewrite an entry.', verifies: ['r_2'], expected: 'Refused.', kind: 'negative' },
      ],
    };
    const advice = checkAdvice({ srs: srsOne, vtp: vtpDoc });
    // r_2 is attacked as well as demonstrated; r_1 is not.
    expect(advice.filter((a) => a.rule === 'vtp-negative-path').map((a) => a.itemId)).toEqual(['r_1']);
  });

  it('says nothing to a register that has not begun classifying its tests', () => {
    // A project not yet drawing the distinction is not nagged about it.
    const unclassified: VtpDoc = {
      schemaVersion: '1.0', type: 'vtp', name: 'A', title: 'VTP',
      items: [{ id: 't_1', text: 'Enter 20.', verifies: ['r_1'], expected: 'Accepted.' }],
    };
    expect(checkAdvice({ srs: srsOne, vtp: unclassified }).some((a) => a.rule === 'vtp-negative-path')).toBe(false);
  });

  it('records which FDA security testing type a test is, so the set can be produced on request', () => {
    const doc: VtpDoc = {
      schemaVersion: '1.0', type: 'vtp', name: 'A', title: 'VTP',
      items: [
        { id: 't_1', text: 'Submit malformed JSON bodies.', verifies: ['r_1'], expected: 'Each is refused without a stack trace.', kind: 'security', securityTest: ['malformed-input', 'fuzz'] },
      ],
    };
    expect(validate(doc)).toEqual([]);
    expect(validate({ ...doc, items: [{ ...doc.items[0], securityTest: ['pen-test'] }] }).length).toBeGreaterThan(0);
  });

  it('marks a drafted item as a draft, so a scaffold is never mistaken for a specification', () => {
    expect(validate({ ...srsOne, items: [{ id: 'r_1', text: 'x', draft: true }] })).toEqual([]);
  });
});
