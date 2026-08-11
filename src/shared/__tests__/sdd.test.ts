import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import { checkGovernance } from '../governance';
import { createSddDoc, createSddSection } from '../factories';
import { docTypeFor, REGISTER_TYPES } from '../docTypes';
import { diffItems } from '../diff';
import type { SddDoc, SrsDoc } from '../schema';

/**
 * The detailed-design pillar (IEC 62304 5.4; FDA Software Design Specification).
 *
 * The claim under test is the one the pillar rests on: a design section can be retitled,
 * reordered and rewritten freely, and the requirement pointing at it still resolves —
 * because the link is on the stable id, never the code or the title.
 */

const sdd: SddDoc = {
  schemaVersion: '1.0',
  type: 'sdd',
  name: 'AcmeApp',
  title: 'Detailed Design',
  items: [
    { id: 'h_sd01', title: 'Design views', heading: true },
    {
      id: 'd_aaa111',
      code: 'SDD-1',
      title: 'auth — session establishment',
      source: ['src/auth.ts'],
      body: '## Secret\nWhich identity provider is in use.\n\n![Sequence](acme.auth.svg)',
    },
    {
      id: 'd_bbb222',
      code: 'SDD-2',
      title: 'report — rendering',
      body: 'Renders a report to PDF. Invalid input: an empty report throws rather than emitting a blank page.',
    },
  ],
};

const srs = (design: Record<string, string[] | undefined>): SrsDoc => ({
  schemaVersion: '1.0',
  type: 'srs',
  name: 'AcmeApp',
  title: 'Requirements',
  items: [
    { id: 'h_01', text: 'Authentication', heading: true },
    { id: 'r_001', code: 'SSO-1', text: 'The system shall authenticate via SAML.', design: design.r_001 },
    { id: 'r_002', code: 'PDF-1', text: 'The system shall render a report to PDF.', design: design.r_002 },
  ],
});

const linked = srs({ r_001: ['d_aaa111'], r_002: ['d_bbb222'] });

describe('SDD — structure', () => {
  it('accepts a well-formed detailed design', () => {
    expect(validate(sdd)).toEqual([]);
  });

  it('accepts a section that is only a heading, and one with no body yet', () => {
    const doc: SddDoc = { ...sdd, items: [{ id: 'h_x', title: 'Units', heading: true }, { id: 'd_x', title: 'stub' }] };
    expect(validate(doc)).toEqual([]);
  });

  it('rejects a section with no title, because a section nobody can name is not reviewable', () => {
    const bad = { ...sdd, items: [{ id: 'd_ccc333' }] };
    expect(validate(bad).length).toBeGreaterThan(0);
  });

  it('creates schema-valid empty documents and sections', () => {
    const doc = createSddDoc('AcmeApp', 'Detailed Design');
    expect(validate(doc)).toEqual([]);
    const section = createSddSection([]);
    expect(section.id).toMatch(/^d_[0-9a-f]{6}$/);
    expect(validate({ ...doc, items: [{ ...section, title: 'unit' }] })).toEqual([]);
  });
});

describe('SDD — registered as a document type', () => {
  it('is an id-keyed register, so snapshots and per-job diffs need no new code', () => {
    const spec = docTypeFor('sdd');
    expect(spec?.kind).toBe('register');
    expect(spec?.inBaseline).toBe(true);
    expect(REGISTER_TYPES.map((d) => d.type)).toContain('sdd');
  });

  it('diffs by section id like any other register', () => {
    const after = sdd.items.map((s) => (s.id === 'd_bbb222' ? { ...s, body: 'Rewritten.' } : s));
    const diff = diffItems(sdd.items, after);

    expect(diff.modified.map((m: { id: string }) => m.id)).toEqual(['d_bbb222']);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });
});

describe('SDD — governance (opt-in)', () => {
  it('is silent when no detailed design is present', () => {
    // A project that does not use the pillar pays nothing, even with no design links.
    const violations = checkGovernance({ srs: srs({}) });
    expect(violations.filter((v) => v.rule.startsWith('sdd-'))).toEqual([]);
  });

  it('passes when every requirement reaches a section', () => {
    const violations = checkGovernance({ srs: linked, sdd });
    expect(violations.filter((v) => v.rule.startsWith('sdd-'))).toEqual([]);
  });

  it('flags a design reference that does not resolve', () => {
    const violations = checkGovernance({ srs: srs({ r_001: ['d_missing'], r_002: ['d_bbb222'] }), sdd });

    expect(violations.map((v) => v.rule)).toContain('sdd-referential-integrity');
    expect(violations[0].itemId).toBe('r_001');
  });

  it('flags a requirement that reaches no design section', () => {
    const violations = checkGovernance({ srs: srs({ r_001: ['d_aaa111'] }), sdd });

    const coverage = violations.filter((v) => v.rule === 'sdd-coverage');
    expect(coverage).toHaveLength(1);
    expect(coverage[0].itemId).toBe('r_002');
  });

  it('does not require a heading to reach the design', () => {
    const violations = checkGovernance({ srs: linked, sdd });
    expect(violations.filter((v) => v.itemId === 'h_01')).toEqual([]);
  });

  it('checks coverage at full rigor regardless of any safety class or documentation level', () => {
    // 62304 makes the per-unit design Class C only and FDA submits the SDS only at
    // Enhanced. Neither appears in the contract: omission is an export decision, so
    // there is no configuration here that could switch this rule off.
    const violations = checkGovernance({ srs: srs({ r_001: ['d_aaa111'] }), sdd });
    expect(violations.some((v) => v.rule === 'sdd-coverage')).toBe(true);
  });
});

describe('SDD — the identity guarantee', () => {
  it('survives retitling, recoding and reordering a section', () => {
    // The whole reason sections carry a stable id: the design must stay free to be
    // rewritten without anyone rechecking the links.
    const rewritten: SddDoc = {
      ...sdd,
      items: [...sdd.items]
        .reverse()
        .map((s) =>
          s.id === 'd_aaa111'
            ? { ...s, code: 'SDD-99', title: 'identity — completely renamed', body: 'Rewritten from scratch.' }
            : s,
        ),
    };

    const violations = checkGovernance({ srs: linked, sdd: rewritten });
    expect(violations.filter((v) => v.rule.startsWith('sdd-'))).toEqual([]);
  });

  it('breaks the link only when the section is actually deleted', () => {
    const deleted: SddDoc = { ...sdd, items: sdd.items.filter((s) => s.id !== 'd_aaa111') };
    const violations = checkGovernance({ srs: linked, sdd: deleted });

    expect(violations.map((v) => v.rule)).toContain('sdd-referential-integrity');
  });
});
