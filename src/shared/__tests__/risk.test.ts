import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import { riskSchema } from '../schema';
import { checkGovernance } from '../governance';
import { createRiskDoc, createRiskItem } from '../factories';
import { docTypeFor, REGISTER_TYPES } from '../docTypes';
import type { RiskDoc, SddDoc, SrsDoc, VtpDoc } from '../schema';

/**
 * Software risk (IEC 62304 §7).
 *
 * The claims under test: a cause is a software unit and not a design view, a control is
 * a requirement (so §7.3 verification comes from the trace already there), and there is
 * no probability field to argue a risk down with.
 */

const sdd: SddDoc = {
  schemaVersion: '1.0',
  type: 'sdd',
  name: 'AcmeApp',
  title: 'Detailed Design',
  items: [
    { id: 'd_unit1', code: 'SDD-1', title: 'pump control' },
    { id: 'd_unit2', code: 'SDD-2', title: 'alarm', kind: 'unit' },
    { id: 'd_view1', code: 'SDD-9', title: 'Dependency', kind: 'view' },
  ],
};

const srs: SrsDoc = {
  schemaVersion: '1.0',
  type: 'srs',
  name: 'AcmeApp',
  title: 'Requirements',
  items: [
    { id: 'r_1', code: 'CTL-1', text: 'The pump shall stop on occlusion.', design: ['d_unit1'] },
    { id: 'r_2', code: 'CTL-2', text: 'The alarm shall sound within 2 s.', design: ['d_unit2'] },
  ],
};

const vtp: VtpDoc = {
  schemaVersion: '1.0',
  type: 'vtp',
  name: 'AcmeApp',
  title: 'Tests',
  items: [
    { id: 't_1', text: 'Occlude the line.', verifies: ['r_1'], expected: 'Pump stops.' },
    { id: 't_2', text: 'Trigger an alarm.', verifies: ['r_2'], expected: 'Sounds in 2 s.' },
  ],
};

const risk = (overrides: Partial<RiskDoc['items'][number]> = {}): RiskDoc => ({
  schemaVersion: '1.0',
  type: 'risk',
  name: 'AcmeApp',
  title: 'Risk',
  items: [
    { id: 'h_1', text: 'Delivery', heading: true },
    {
      id: 'k_1',
      code: 'RISK-1',
      text: 'Infusion continues after an occlusion clears.',
      severity: 'serious',
      causes: ['d_unit1'],
      controls: ['r_1'],
      residual: 'acceptable',
      ...overrides,
    },
  ],
});

const only = (violations: { rule: string; message: string }[]) => violations.filter((v) => v.rule.startsWith('risk-'));

describe('risk register — structure', () => {
  it('accepts a well-formed risk analysis', () => {
    expect(validate(risk())).toEqual([]);
  });

  it('rejects a risk with no text', () => {
    const bad = { ...risk(), items: [{ id: 'k_x', severity: 'serious' }] };
    expect(validate(bad).length).toBeGreaterThan(0);
  });

  it('rejects a severity outside the scale', () => {
    expect(validate(risk({ severity: 'quite bad' as never })).length).toBeGreaterThan(0);
  });

  it('defines no probability field to argue a risk down with', () => {
    // For software you cannot argue probability down; severity drives the analysis. The
    // contract simply has nowhere to record one — asserted against the schema, since the
    // registers do not forbid unknown properties in general.
    const properties = (riskSchema as { properties: { items: { items: { properties: Record<string, unknown> } } } })
      .properties.items.items.properties;

    expect(Object.keys(properties)).toContain('severity');
    expect(Object.keys(properties)).not.toContain('probability');
    expect(Object.keys(properties)).not.toContain('likelihood');
  });

  it('creates schema-valid documents and items, unassessed by default', () => {
    const doc = createRiskDoc('AcmeApp', 'Risk');
    expect(validate(doc)).toEqual([]);

    const item = createRiskItem([]);
    expect(item.id).toMatch(/^k_[0-9a-f]{6}$/);
    expect(item.residual).toBe('not_assessed');
  });

  it('is a registered register type, so it is snapshotted and diffed like the others', () => {
    expect(docTypeFor('risk')?.kind).toBe('register');
    expect(docTypeFor('risk')?.inBaseline).toBe(true);
    expect(REGISTER_TYPES.map((d) => d.type)).toContain('risk');
  });

  it('is never drafted by the generator', () => {
    // Code cannot supply a judgement about harm; a generated hazard would be invention.
    expect(docTypeFor('risk')?.generate).toBe('never');
  });
});

describe('risk governance (opt-in)', () => {
  it('is silent when no risk register is present', () => {
    expect(only(checkGovernance({ srs, vtp, sdd }))).toEqual([]);
  });

  it('passes a risk with a unit cause and a requirement control', () => {
    expect(only(checkGovernance({ srs, vtp, sdd, risk: risk() }))).toEqual([]);
  });

  it('rejects a cause that is a design view rather than a software unit', () => {
    const violations = only(checkGovernance({ srs, vtp, sdd, risk: risk({ causes: ['d_view1'] }) }));

    expect(violations.map((v) => v.rule)).toContain('risk-referential-integrity');
    expect(violations[0].message).toMatch(/design view rather than a software unit/);
  });

  it('treats a section with no kind as a unit', () => {
    // d_unit1 declares no kind; the common case must not need one.
    expect(only(checkGovernance({ srs, vtp, sdd, risk: risk({ causes: ['d_unit1'] }) }))).toEqual([]);
  });

  it('flags an unresolved cause and an unresolved control', () => {
    const violations = only(
      checkGovernance({ srs, vtp, sdd, risk: risk({ causes: ['d_gone'], controls: ['r_gone'] }) }),
    );

    expect(violations.filter((v) => v.rule === 'risk-referential-integrity')).toHaveLength(2);
  });

  it('flags a risk that names no software cause', () => {
    const violations = only(checkGovernance({ srs, vtp, sdd, risk: risk({ causes: [] }) }));

    expect(violations.map((v) => v.rule)).toContain('risk-cause');
  });

  it('flags a risk with neither a control nor a justification', () => {
    const violations = only(checkGovernance({ srs, vtp, sdd, risk: risk({ controls: [] }) }));

    expect(violations.map((v) => v.rule)).toContain('risk-controlled');
  });

  it('accepts a risk controlled outside the software, when that is recorded', () => {
    const violations = only(
      checkGovernance({
        srs,
        vtp,
        sdd,
        risk: risk({ controls: [], justification: 'Controlled by the occlusion sensor in hardware.' }),
      }),
    );

    expect(violations).toEqual([]);
  });

  it('does not require a heading to have causes or controls', () => {
    const violations = checkGovernance({ srs, vtp, sdd, risk: risk() });
    expect(violations.filter((v) => v.itemId === 'h_1')).toEqual([]);
  });
});

describe('verification of risk controls comes from the existing trace (§7.3)', () => {
  it('a control is a requirement, so its verifying tests are the evidence', () => {
    // Nothing in the risk register records verification: the control points at r_1, and
    // r_1 is verified by t_1 under the traceability rule that already exists.
    const violations = checkGovernance({ srs, vtp, sdd, risk: risk() });
    expect(violations).toEqual([]);

    const uncovered: VtpDoc = { ...vtp, items: [vtp.items[1]] };
    const now = checkGovernance({ srs, vtp: uncovered, sdd, risk: risk() });

    // The control's requirement lost its test: reported by traceability, not by a
    // duplicate rule in the risk register.
    expect(now.map((v) => v.rule)).toContain('traceability');
    expect(only(now)).toEqual([]);
  });
});
