import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import { checkGovernance } from '../governance';
import { createSoupDoc, createSoupItem } from '../factories';
import { docTypeFor, REGISTER_TYPES } from '../docTypes';
import type { RiskDoc, SddDoc, SoupDoc, SrsDoc, VtpDoc } from '../schema';

/**
 * SOUP / off-the-shelf software (IEC 62304; FDA off-the-shelf guidance).
 *
 * The claims under test: a component is identified by an exact version, its anomalies
 * are evaluated rather than assumed absent, and it can be the cause of a risk exactly as
 * one of our own units can.
 */

const component = (over: Partial<SoupDoc['items'][number]> = {}) => ({
  id: 's_1',
  code: 'SOUP-1',
  name: 'ajv',
  vendor: 'Evgeny Poberezkin and contributors',
  version: '8.20.0',
  requirements: 'Validates against JSON Schema draft-07 and reports every violation.',
  ...over,
});

const soup = (over: Partial<SoupDoc['items'][number]> = {}): SoupDoc => ({
  schemaVersion: '1.0',
  type: 'soup',
  name: 'Acme',
  title: 'SOUP',
  items: [{ id: 'h_1', name: 'Runtime', heading: true }, component(over)],
});

const sdd: SddDoc = {
  schemaVersion: '1.0', type: 'sdd', name: 'Acme', title: 'Detailed Design',
  items: [{ id: 'd_1', code: 'SDD-1', title: 'validate' }],
};
const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'Acme', title: 'Requirements',
  items: [{ id: 'r_1', code: 'VAL-1', text: 'Documents shall be validated.', design: ['d_1'] }],
};
const vtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'Acme', title: 'Tests',
  items: [{ id: 't_1', code: 'TEST-1', text: 'Validate a bad document.', verifies: ['r_1'], expected: 'Reported.' }],
};

const only = (v: { rule: string; message: string }[]) => v.filter((x) => x.rule.startsWith('soup-'));

describe('SOUP register — structure', () => {
  it('accepts a well-formed component list', () => {
    expect(validate(soup())).toEqual([]);
  });

  it('requires a name, which is the least an entry can be', () => {
    expect(validate({ ...soup(), items: [{ id: 's_x', vendor: 'Someone' }] }).length).toBeGreaterThan(0);
  });

  it('creates schema-valid documents and items', () => {
    expect(validate(createSoupDoc('Acme', 'SOUP'))).toEqual([]);
    expect(createSoupItem([]).id).toMatch(/^s_[0-9a-f]{6}$/);
  });

  it('is a registered register type, snapshotted and diffed like the others', () => {
    expect(docTypeFor('soup')?.kind).toBe('register');
    expect(docTypeFor('soup')?.inBaseline).toBe(true);
    expect(REGISTER_TYPES.map((d) => d.type)).toContain('soup');
  });
});

describe('SOUP governance (opt-in)', () => {
  it('is silent when no register is present', () => {
    expect(only(checkGovernance({ srs, vtp, sdd }))).toEqual([]);
  });

  it('passes a component that is identified, required of, and evaluated', () => {
    expect(only(checkGovernance({ srs, vtp, sdd, soup: soup() }))).toEqual([]);
  });

  it('flags a component with no supplier or no version', () => {
    expect(only(checkGovernance({ srs, vtp, sdd, soup: soup({ vendor: '' }) })).map((v) => v.rule))
      .toContain('soup-identity');
    expect(only(checkGovernance({ srs, vtp, sdd, soup: soup({ version: '' }) })).map((v) => v.rule))
      .toContain('soup-identity');
  });

  it('flags a component with no requirements placed on it', () => {
    expect(only(checkGovernance({ srs, vtp, sdd, soup: soup({ requirements: '' }) })).map((v) => v.rule))
      .toContain('soup-requirements');
  });

  it('records an end-of-life date and where it came from', () => {
    const doc = soup({ endOfLife: '2019-07-24', endOfLifeSource: 'https://example.invalid/eol' });
    expect(validate(doc)).toEqual([]);
    expect(only(checkGovernance({ srs, vtp, sdd, soup: doc }))).toEqual([]);
  });

  it('flags an unresolved usedBy or test reference', () => {
    const violations = only(
      checkGovernance({ srs, vtp, sdd, soup: soup({ usedBy: ['d_gone'], tests: ['t_gone'] }) }),
    );
    expect(violations.filter((v) => v.rule === 'soup-referential-integrity')).toHaveLength(2);
  });

  it('accepts resolved usedBy and test references', () => {
    expect(only(checkGovernance({ srs, vtp, sdd, soup: soup({ usedBy: ['d_1'], tests: ['t_1'] }) }))).toEqual([]);
  });

  it('does not require a heading to be identified or evaluated', () => {
    const violations = checkGovernance({ srs, vtp, sdd, soup: soup() });
    expect(violations.filter((v) => v.itemId === 'h_1')).toEqual([]);
  });
});

describe('a component can be the cause of a risk (§7.1.2)', () => {
  const risk = (causes: string[]): RiskDoc => ({
    schemaVersion: '1.0', type: 'risk', name: 'Acme', title: 'Risk',
    items: [{ id: 'k_1', text: 'A malformed document is accepted.', causes, controls: ['r_1'], residual: 'acceptable' }],
  });

  it('accepts a SOUP id as a cause, as it accepts a design unit', () => {
    const violations = checkGovernance({ srs, vtp, sdd, soup: soup(), risk: risk(['s_1']) });
    expect(violations.filter((v) => v.rule.startsWith('risk-'))).toEqual([]);
  });

  it('accepts both kinds of cause on one risk', () => {
    const violations = checkGovernance({ srs, vtp, sdd, soup: soup(), risk: risk(['d_1', 's_1']) });
    expect(violations.filter((v) => v.rule.startsWith('risk-'))).toEqual([]);
  });

  it('still rejects a cause that is neither', () => {
    const violations = checkGovernance({ srs, vtp, sdd, soup: soup(), risk: risk(['x_nope']) });
    expect(violations.map((v) => v.rule)).toContain('risk-referential-integrity');
    expect(violations[0].message).toMatch(/neither a known design section nor a known component/);
  });

  it('does not accept a SOUP heading as a cause', () => {
    const violations = checkGovernance({ srs, vtp, sdd, soup: soup(), risk: risk(['h_1']) });
    expect(violations.map((v) => v.rule)).toContain('risk-referential-integrity');
  });
});
