import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import { threatSchema } from '../schema';
import { checkGovernance } from '../governance';
import { createThreatDoc, createThreatItem } from '../factories';
import { docTypeFor, REGISTER_TYPES } from '../docTypes';
import type { RiskDoc, SddDoc, SoupDoc, SrsDoc, ThreatDoc, VtpDoc } from '../schema';

/**
 * Threat model and security risk (FDA cybersecurity guidance; IEC 81001-5-1; AAMI SW96).
 *
 * The claims under test: one register rather than two, exploitability in place of
 * probability, a component is attack surface as much as a unit is, and a threat with a
 * patient consequence links to the safety risk it creates.
 */

const sdd: SddDoc = {
  schemaVersion: '1.0', type: 'sdd', name: 'Acme', title: 'Detailed Design',
  items: [
    { id: 'd_1', code: 'SDD-1', title: 'auth' },
    { id: 'd_v', code: 'SDD-9', title: 'Dependency', kind: 'view' },
  ],
};
const soup: SoupDoc = {
  schemaVersion: '1.0', type: 'soup', name: 'Acme', title: 'SOUP',
  items: [{ id: 's_1', code: 'SOUP-1', name: 'ajv', vendor: 'x', version: '8.20.0', requirements: 'Validates.' }],
};
const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'Acme', title: 'Requirements',
  items: [{ id: 'r_1', code: 'AUTH-1', text: 'Identity shall be asserted by a trusted peer.', design: ['d_1'] }],
};
const vtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'Acme', title: 'Tests',
  items: [{ id: 't_1', text: 'Assert a header from an untrusted peer.', verifies: ['r_1'], expected: 'Refused.' }],
};
const risk: RiskDoc = {
  schemaVersion: '1.0', type: 'risk', name: 'Acme', title: 'Risk',
  items: [{ id: 'k_1', code: 'RISK-1', text: 'A change is attributed to the wrong person.', causes: ['d_1'], controls: ['r_1'] }],
};

const threat = (over: Partial<ThreatItem> = {}): ThreatDoc => ({
  schemaVersion: '1.0', type: 'threat', name: 'Acme', title: 'Threats',
  items: [
    { id: 'h_1', text: 'Identity', heading: true },
    {
      id: 'x_1', code: 'THR-1',
      text: 'An attacker asserts an identity header directly against the server.',
      asset: 'The authenticated identity', entryPoint: 'The HTTP API',
      category: 'spoofing', exploitability: 'low', impact: 'serious',
      causes: ['d_1'], controls: ['r_1'], safetyRisk: ['k_1'], residual: 'acceptable',
      ...over,
    },
  ],
});
type ThreatItem = ThreatDoc['items'][number];

const only = (v: { rule: string; message: string }[]) => v.filter((x) => x.rule.startsWith('threat-'));
const base = { srs, vtp, sdd, soup, risk };

describe('threat register — structure', () => {
  it('accepts a well-formed threat model', () => {
    expect(validate(threat())).toEqual([]);
  });

  it('rejects a STRIDE category outside the six', () => {
    expect(validate(threat({ category: 'phishing' as never })).length).toBeGreaterThan(0);
  });

  it('rejects an exploitability outside the scale', () => {
    expect(validate(threat({ exploitability: 'certain' as never })).length).toBeGreaterThan(0);
  });

  it('defines exploitability and no probability, because an attacker chooses when to act', () => {
    const properties = (threatSchema as { properties: { items: { items: { properties: Record<string, unknown> } } } })
      .properties.items.items.properties;

    expect(Object.keys(properties)).toContain('exploitability');
    expect(Object.keys(properties)).not.toContain('probability');
    expect(Object.keys(properties)).not.toContain('likelihood');
  });

  it('creates schema-valid documents and items, unassessed by default', () => {
    expect(validate(createThreatDoc('Acme', 'Threats'))).toEqual([]);
    const item = createThreatItem([]);
    expect(item.id).toMatch(/^x_[0-9a-f]{6}$/);
    expect(item.residual).toBe('not_assessed');
  });

  it('is a registered register type, and is never generated', () => {
    expect(docTypeFor('threat')?.kind).toBe('register');
    expect(docTypeFor('threat')?.inBaseline).toBe(true);
    expect(REGISTER_TYPES.map((d) => d.type)).toContain('threat');
    // An attacker's intent is not derivable from source.
    expect(docTypeFor('threat')?.generate).toBe('never');
  });

  it('registers the security architecture as a prose document', () => {
    expect(docTypeFor('sec')?.kind).toBe('prose');
    expect(docTypeFor('sec')?.inBaseline).toBe(true);
  });
});

describe('threat governance (opt-in)', () => {
  it('is silent when no threat model is present', () => {
    expect(only(checkGovernance(base))).toEqual([]);
  });

  it('passes a threat that is assessed and controlled', () => {
    expect(only(checkGovernance({ ...base, threat: threat() }))).toEqual([]);
  });

  it('flags a threat missing an exploitability or an impact', () => {
    expect(only(checkGovernance({ ...base, threat: threat({ exploitability: undefined }) })).map((v) => v.rule))
      .toContain('threat-assessed');
    expect(only(checkGovernance({ ...base, threat: threat({ impact: undefined }) })).map((v) => v.rule))
      .toContain('threat-assessed');
  });

  it('flags a threat with neither a control nor a justification', () => {
    expect(only(checkGovernance({ ...base, threat: threat({ controls: [] }) })).map((v) => v.rule))
      .toContain('threat-controlled');
  });

  it('accepts a threat recorded as uncontrolled, when that is said', () => {
    const doc = threat({ controls: [], justification: 'Accepted; controlled by the deployment network.' });
    expect(only(checkGovernance({ ...base, threat: doc }))).toEqual([]);
  });

  it('accepts a component as attack surface, as it accepts a unit', () => {
    expect(only(checkGovernance({ ...base, threat: threat({ causes: ['s_1'] }) }))).toEqual([]);
    expect(only(checkGovernance({ ...base, threat: threat({ causes: ['d_1', 's_1'] }) }))).toEqual([]);
  });

  it('rejects a design view as attack surface, and an unknown id', () => {
    expect(only(checkGovernance({ ...base, threat: threat({ causes: ['d_v'] }) })).map((v) => v.rule))
      .toContain('threat-referential-integrity');
    expect(only(checkGovernance({ ...base, threat: threat({ causes: ['nope'] }) })).map((v) => v.rule))
      .toContain('threat-referential-integrity');
  });

  it('flags an unresolved control or safety risk', () => {
    const violations = only(checkGovernance({ ...base, threat: threat({ controls: ['r_gone'], safetyRisk: ['k_gone'] }) }));
    expect(violations.filter((v) => v.rule === 'threat-referential-integrity')).toHaveLength(2);
  });

  it('does not require a heading to be assessed or controlled', () => {
    expect(checkGovernance({ ...base, threat: threat() }).filter((v) => v.itemId === 'h_1')).toEqual([]);
  });
});

describe('the join to safety risk (AAMI SW96)', () => {
  it('links a threat to the safety risk exploiting it would create', () => {
    const doc = threat();
    expect(doc.items[1].safetyRisk).toEqual(['k_1']);
    expect(only(checkGovernance({ ...base, threat: doc }))).toEqual([]);
  });

  it('accepts a threat with no safety consequence, which is a statement rather than an omission', () => {
    expect(only(checkGovernance({ ...base, threat: threat({ safetyRisk: [] }) }))).toEqual([]);
  });

  it('verification of a security control comes from the requirement, not from the threat', () => {
    // Nothing about verification is stored here: the control points at r_1, and r_1 is
    // verified by t_1 under the traceability rule that already exists.
    const withoutTest: VtpDoc = { ...vtp, items: [] };
    const violations = checkGovernance({ ...base, vtp: withoutTest, threat: threat() });

    expect(violations.map((v) => v.rule)).toContain('traceability');
    expect(only(violations)).toEqual([]);
  });
});
