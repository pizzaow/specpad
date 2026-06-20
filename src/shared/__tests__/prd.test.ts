import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import { checkGovernance } from '../governance';
import { createPrdDoc, createPrdItem } from '../factories';
import type { PrdDoc, SrsDoc } from '../schema';

const prd: PrdDoc = {
  schemaVersion: '1.0',
  type: 'prd',
  name: 'AcmeApp',
  title: 'Product Requirements',
  items: [
    { id: 'p_aaa111', code: 'PROD-1', text: 'Users can sign in with SSO.', status: 'implemented' },
    { id: 'p_bbb222', code: 'PROD-2', text: 'Reports export as PDF.', status: 'implemented' },
  ],
};

const srs = (satisfies: Record<string, string[]>): SrsDoc => ({
  schemaVersion: '1.0',
  type: 'srs',
  name: 'AcmeApp',
  title: 'Requirements',
  items: [
    { id: 'r_001', code: 'SSO-1', text: 'The system shall authenticate via SAML.', satisfies: satisfies.r_001 },
    { id: 'r_002', code: 'PDF-1', text: 'The system shall render a report to PDF.', satisfies: satisfies.r_002 },
  ],
});

describe('PRD register — structure', () => {
  it('accepts a well-formed PRD document', () => {
    expect(validate(prd)).toEqual([]);
  });

  it('rejects a PRD document missing items', () => {
    const bad: Record<string, unknown> = { ...prd };
    delete bad.items;
    expect(validate(bad).length).toBeGreaterThan(0);
  });

  it('rejects a PRD item missing required text', () => {
    const bad = { ...prd, items: [{ id: 'p_x' }] };
    expect(validate(bad).length).toBeGreaterThan(0);
  });

  it('factories build a PRD doc and p_-prefixed, proposed-by-default items', () => {
    const doc = createPrdDoc('acme', 'Product Requirements');
    expect(doc.type).toBe('prd');
    const item = createPrdItem([]);
    expect(item.id).toMatch(/^p_[0-9a-f]{6}$/);
    expect(item.status).toBe('proposed');
  });

  it('accepts a status enum value and rejects one outside it', () => {
    expect(validate({ ...prd, items: [{ id: 'p_x', text: 'ok', status: 'proposed' }] })).toEqual([]);
    expect(validate({ ...prd, items: [{ id: 'p_x', text: 'bad', status: 'shipped' }] }).length).toBeGreaterThan(0);
  });

  it('lets the project index reference a PRD document', () => {
    const project = {
      schemaVersion: '1.0',
      type: 'project',
      name: 'acme',
      title: 'Acme',
      documents: [{ type: 'prd', path: 'acme.prd.json', title: 'Product Requirements' }],
    };
    expect(validate(project)).toEqual([]);
  });
});

describe('PRD register — governance', () => {
  it('raises no PRD violations when every satisfies resolves and every PRD item is covered', () => {
    const v = checkGovernance({ srs: srs({ r_001: ['p_aaa111'], r_002: ['p_bbb222'] }), prd });
    expect(v.filter((x) => x.rule.startsWith('prd-'))).toEqual([]);
  });

  it('flags a satisfies reference that does not resolve to a PRD id', () => {
    const v = checkGovernance({ srs: srs({ r_001: ['p_nope'], r_002: ['p_bbb222'] }), prd });
    expect(v.some((x) => x.rule === 'prd-referential-integrity' && x.itemId === 'r_001')).toBe(true);
  });

  it('flags an implemented PRD item that no requirement satisfies', () => {
    const v = checkGovernance({ srs: srs({ r_001: ['p_aaa111'] }), prd });
    expect(v.some((x) => x.rule === 'prd-coverage' && x.itemId === 'p_bbb222')).toBe(true);
  });

  it('exempts proposed (and status-less) PRD items from coverage', () => {
    const visionPrd: PrdDoc = {
      ...prd,
      items: [
        { id: 'p_aaa111', code: 'PROD-1', text: 'Built feature.', status: 'implemented' },
        { id: 'p_road01', code: 'PROD-9', text: 'Future roadmap item.', status: 'proposed' },
        { id: 'p_road02', code: 'PROD-10', text: 'Captured intent, no status.' },
      ],
    };
    const v = checkGovernance({ srs: srs({ r_001: ['p_aaa111'] }), prd: visionPrd });
    // Only the implemented item needs coverage (and it has it); roadmap items raise nothing.
    expect(v.filter((x) => x.rule === 'prd-coverage')).toEqual([]);
  });

  it('applies no PRD governance when no PRD register is present', () => {
    // SRS carries satisfies, but with no PRD doc the rules are skipped entirely.
    const v = checkGovernance({ srs: srs({ r_001: ['p_aaa111'], r_002: ['p_orphan'] }) });
    expect(v.some((x) => x.rule.startsWith('prd-'))).toBe(false);
  });
});
