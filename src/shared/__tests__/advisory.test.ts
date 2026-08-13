import { describe, it, expect } from 'vitest';
import { checkGovernance, checkAdvice, GOVERNANCE_RULES } from '../governance';
import type { ProjectDoc, SrsDoc, VtpDoc } from '../schema';

/**
 * The advisory tier (JOB-56).
 *
 * Two things needed a finding that does not fail. A safety classification has to be able to
 * say "this is beyond what Class B requires" without calling it a defect. And a rule asking
 * every requirement to declare its 5.2.2 category would fire on 273 existing requirements
 * the day it shipped, which teaches people to ignore governance rather than to use it.
 *
 * So advisories are reported separately and never block, and a project opts into being held
 * to one by naming it in `enforce`.
 */

const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'Acme', title: 'Requirements',
  items: [
    { id: 'r_1', code: 'A-1', text: 'The thing shall do the thing.', category: 'functional' },
    { id: 'r_2', code: 'A-2', text: 'The other thing shall also happen.' }, // no category
  ],
};
const vtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'Acme', title: 'Tests',
  items: [
    { id: 't_1', text: 'Do the thing.', verifies: ['r_1'], expected: 'It happened.', verificationLevel: 'system' },
    { id: 't_2', text: 'Do the other.', verifies: ['r_2'], expected: 'It happened.' }, // no level
  ],
};
const project = (over: Partial<ProjectDoc> = {}): ProjectDoc => ({
  schemaVersion: '1.0', type: 'project', name: 'Acme', title: 'Acme', documents: [], ...over,
} as ProjectDoc);

const bundle = (over = {}) => ({ srs, vtp, project: project(), ...over });

describe('advisories are findings that do not fail', () => {
  it('keeps advisory findings out of the blocking result', () => {
    // r_2 has no category and t_2 no level: advice, not violations.
    expect(checkGovernance(bundle())).toEqual([]);
    expect(checkAdvice(bundle()).length).toBeGreaterThan(0);
  });

  it('names the rule and the item it is about', () => {
    const advice = checkAdvice(bundle());
    const category = advice.find((a) => a.rule === 'srs-category');
    expect(category?.itemId).toBe('r_2');
    expect(category?.severity).toBe('advisory');
    expect(advice.find((a) => a.rule === 'vtp-verification-level')?.itemId).toBe('t_2');
  });

  it('says nothing about an item that has the field', () => {
    expect(checkAdvice(bundle()).some((a) => a.itemId === 'r_1')).toBe(false);
    expect(checkAdvice(bundle()).some((a) => a.itemId === 't_1')).toBe(false);
  });
});

describe('a project promotes an advisory to blocking', () => {
  it('moves the finding into the blocking result when the rule is enforced', () => {
    const enforced = bundle({ project: project({ enforce: ['srs-category'] }) });

    const violations = checkGovernance(enforced);
    expect(violations.map((v) => v.rule)).toContain('srs-category');
    expect(violations.find((v) => v.rule === 'srs-category')?.itemId).toBe('r_2');

    // Promoted rules are no longer merely advice, and the ones not promoted still are.
    const advice = checkAdvice(enforced);
    expect(advice.some((a) => a.rule === 'srs-category')).toBe(false);
    expect(advice.some((a) => a.rule === 'vtp-verification-level')).toBe(true);
  });

  it('ignores an enforce entry naming a rule that does not exist', () => {
    const odd = bundle({ project: project({ enforce: ['no-such-rule'] as never }) });
    expect(checkGovernance(odd)).toEqual([]);
  });

  it('is silent for a project with nothing to advise on', () => {
    const clean = { srs: { ...srs, items: [srs.items[0]] }, vtp: { ...vtp, items: [vtp.items[0]] }, project: project() };
    expect(checkAdvice(clean)).toEqual([]);
    expect(checkGovernance(clean)).toEqual([]);
  });
});

describe('the rule register describes both tiers', () => {
  it('marks which rules are advisory by default', () => {
    const byId = new Map(GOVERNANCE_RULES.map((r) => [r.id, r]));
    expect(byId.get('srs-category')?.tier).toBe('advisory');
    expect(byId.get('vtp-verification-level')?.tier).toBe('advisory');
    // The rules that always blocked still block.
    expect(byId.get('traceability')?.tier).toBe('violation');
  });
});
