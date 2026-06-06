import { describe, it, expect } from 'vitest';
import { checkGovernance, GOVERNANCE_RULES } from '../governance';
import type { SrsDoc, VtpDoc } from '../schema';

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

  it('exposes a stable list of rule ids', () => {
    expect(GOVERNANCE_RULES.map((r) => r.id).sort()).toEqual([
      'missing-expected', 'referential-integrity', 'traceability',
    ]);
  });
});
