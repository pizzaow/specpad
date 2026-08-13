import { describe, it, expect } from 'vitest';
import { checkGovernance, checkAdvice, GOVERNANCE_RULES } from '../governance';
import { validate } from '../validate';
import { REQUIREMENT_CATEGORIES } from '../schema';
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
    { id: 'r_1', code: 'A-1', text: 'The thing shall do the thing.', category: ['functional'] },
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

describe('§5.2.2 categories overlap, so a requirement may hold several', () => {
  it('accepts more than one category on one requirement', () => {
    // A1:2015 NOTE 10: "The requirements in a) through l) can overlap." A networked alarm
    // is genuinely three of them, and forcing one would under-count the coverage sweep.
    const doc: SrsDoc = {
      ...srs,
      items: [{ id: 'r_1', code: 'A-1', text: 'A dropped link shall raise an operator warning within 2 s.', category: ['alarms', 'it-network', 'functional'] }],
    };
    expect(validate(doc)).toEqual([]);
    expect(checkAdvice({ srs: doc, project: project() }).some((a) => a.rule === 'srs-category')).toBe(false);
  });

  it('advises only when the list is absent or empty, not when it is short', () => {
    const one: SrsDoc = { ...srs, items: [{ id: 'r_1', text: 'x', category: ['regulatory'] }] };
    const none: SrsDoc = { ...srs, items: [{ id: 'r_1', text: 'x', category: [] }] };
    expect(checkAdvice({ srs: one, project: project() }).some((a) => a.rule === 'srs-category')).toBe(false);
    expect(checkAdvice({ srs: none, project: project() }).some((a) => a.rule === 'srs-category')).toBe(true);
  });

  it('rejects a value outside the twelve', () => {
    const doc = { ...srs, items: [{ id: 'r_1', text: 'x', category: ['usability'] }] } as unknown;
    expect(validate(doc).length).toBeGreaterThan(0);
  });

  it('carries all twelve of a)-l), including the two A1:2015 replaced', () => {
    expect(REQUIREMENT_CATEGORIES).toHaveLength(12);
    expect(REQUIREMENT_CATEGORIES.map((c) => c.letter).join('')).toBe('abcdefghijkl');
    const byValue = new Map(REQUIREMENT_CATEGORIES.map((c) => [c.value, c]));
    // f) became "user interface requirements implemented by software"; j) became IT-network.
    expect(byValue.get('user-interface')?.letter).toBe('f');
    expect(byValue.get('it-network')?.letter).toBe('j');
    // i) methods of operation and maintenance is not the same item as k) user maintenance.
    expect(byValue.get('operation-maintenance')?.letter).toBe('i');
    expect(byValue.get('user-maintenance')?.letter).toBe('k');
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
