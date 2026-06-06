import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import type { SrsDoc, VtpDoc, ProjectDoc } from '../schema';

const validSrs: SrsDoc = {
  schemaVersion: '1.0',
  type: 'srs',
  name: 'AcmeApp',
  title: 'Requirements',
  items: [{ id: 'r_001', text: 'The system shall start.' }],
};

describe('validate', () => {
  it('returns no errors for a valid srs doc', () => {
    expect(validate(validSrs)).toEqual([]);
  });

  it('flags a non-object document', () => {
    expect(validate(null).length).toBeGreaterThan(0);
    expect(validate(42 as unknown).length).toBeGreaterThan(0);
  });

  it('flags an unknown document type', () => {
    const errs = validate({ schemaVersion: '1.0', type: 'nope' });
    expect(errs.some((e) => /type/i.test(e.message))).toBe(true);
  });

  it('flags an srs item missing text', () => {
    const bad = { ...validSrs, items: [{ id: 'r_001' }] };
    const errs = validate(bad);
    expect(errs.some((e) => /text/.test(e.message))).toBe(true);
  });

  it('flags an srs item missing id', () => {
    const bad = { ...validSrs, items: [{ text: 'no id' }] };
    expect(validate(bad).some((e) => /id/.test(e.message))).toBe(true);
  });

  it('flags an invalid vtp result enum value', () => {
    const bad: VtpDoc = {
      schemaVersion: '1.0',
      type: 'vtp',
      name: 'AcmeApp',
      title: 'Tests',
      items: [{ id: 't_001', text: 'do it', result: 'maybe' as never }],
    };
    expect(validate(bad).some((e) => /result/.test(e.message))).toBe(true);
  });

  it('accepts a valid project doc', () => {
    const proj: ProjectDoc = {
      schemaVersion: '1.0',
      type: 'project',
      name: 'AcmeApp',
      title: 'AcmeApp System',
      documents: [{ type: 'srs', path: 'AcmeApp.srs.json', title: 'Requirements' }],
    };
    expect(validate(proj)).toEqual([]);
  });
});
