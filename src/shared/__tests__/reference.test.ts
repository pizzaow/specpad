import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import { checkGovernance } from '../governance';
import { createReferenceDoc, createReferenceItem } from '../factories';
import { docTypeFor, REGISTER_TYPES } from '../docTypes';
import type { ReferenceDoc } from '../schema';

/**
 * The references register (JOB-56).
 *
 * IEC 62304 requires software development planning (§5.1), maintenance (clause 6) and
 * problem resolution (clause 9). Most organisations already run those in a quality system
 * or an issue tracker, and modelling them here would duplicate that and put SpecPad in the
 * tracker business it has avoided. So the register names and locates them instead — the
 * move `hazardRef` already makes for the system risk management file.
 *
 * The two rules exist to keep it honest and short: a reference must be findable, and it
 * must discharge something.
 */

const doc = (over: Partial<ReferenceDoc['items'][number]> = {}): ReferenceDoc => ({
  schemaVersion: '1.0', type: 'reference', name: 'Acme', title: 'References',
  items: [
    { id: 'h_1', title: 'Quality system', heading: true },
    {
      id: 'f_1', code: 'REF-1',
      title: 'Software Problem Resolution Procedure',
      kind: 'sop',
      identifier: 'SOP-012 rev C',
      location: 'https://qms.acme.example/SOP-012',
      owner: 'Quality',
      covers: ['IEC 62304 clause 9', 'IEC 62304 5.6.8', 'IEC 62304 8.2.4'],
      ...over,
    },
  ],
});

const only = (v: { rule: string }[]) => v.filter((x) => x.rule.startsWith('reference-'));

describe('references — structure', () => {
  it('accepts a well-formed register', () => {
    expect(validate(doc())).toEqual([]);
  });

  it('rejects a kind outside the list', () => {
    expect(validate(doc({ kind: 'memo' as never })).length).toBeGreaterThan(0);
  });

  it('creates schema-valid documents and items', () => {
    expect(validate(createReferenceDoc('Acme', 'References'))).toEqual([]);
    expect(createReferenceItem([]).id).toMatch(/^f_[0-9a-f]{6}$/);
  });

  it('is a register type that is never generated', () => {
    expect(docTypeFor('reference')?.kind).toBe('register');
    expect(docTypeFor('reference')?.inBaseline).toBe(true);
    expect(REGISTER_TYPES.map((d) => d.type)).toContain('reference');
    // Where a company keeps its SOPs is not derivable from source.
    expect(docTypeFor('reference')?.generate).toBe('never');
  });
});

describe('reference governance (opt-in)', () => {
  it('is silent when no register is present', () => {
    expect(only(checkGovernance({}))).toEqual([]);
  });

  it('passes an entry that can be found and discharges something', () => {
    expect(only(checkGovernance({ reference: doc() }))).toEqual([]);
  });

  it('flags an entry with no location or no kind', () => {
    expect(only(checkGovernance({ reference: doc({ location: '  ' }) })).map((v) => v.rule))
      .toContain('reference-located');
    expect(only(checkGovernance({ reference: doc({ kind: undefined }) })).map((v) => v.rule))
      .toContain('reference-located');
  });

  it('flags an entry that discharges nothing, because the register is meant to stay short', () => {
    expect(only(checkGovernance({ reference: doc({ covers: [] }) })).map((v) => v.rule))
      .toContain('reference-covers');
    expect(only(checkGovernance({ reference: doc({ covers: ['  '] }) })).map((v) => v.rule))
      .toContain('reference-covers');
  });

  it('does not hold a heading to either rule', () => {
    expect(checkGovernance({ reference: doc() }).filter((v) => v.itemId === 'h_1')).toEqual([]);
  });
});
