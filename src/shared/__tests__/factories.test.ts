import { describe, it, expect } from 'vitest';
import {
  createProjectDoc,
  createSrsDoc,
  createVtpDoc,
  createSrsItem,
  createVtpItem,
} from '../factories';
import { validate } from '../validate';

describe('factories', () => {
  it('creates a schema-valid empty srs doc', () => {
    const doc = createSrsDoc('AcmeApp', 'Requirements');
    expect(validate(doc)).toEqual([]);
    expect(doc.type).toBe('srs');
    expect(doc.schemaVersion).toBe('1.0');
  });

  it('creates a schema-valid empty vtp doc', () => {
    expect(validate(createVtpDoc('AcmeApp', 'Tests'))).toEqual([]);
  });

  it('creates a schema-valid project doc with document refs', () => {
    const doc = createProjectDoc('AcmeApp', 'AcmeApp System');
    expect(validate(doc)).toEqual([]);
    expect(doc.documents.map((d) => d.type)).toEqual(['srs', 'vtp']);
  });

  it('creates srs items with unique r_ ids', () => {
    const a = createSrsItem([]);
    const b = createSrsItem([a.id]);
    expect(a.id).toMatch(/^r_[0-9a-f]{6}$/);
    expect(b.id).not.toBe(a.id);
  });

  it('creates vtp items with t_ ids', () => {
    expect(createVtpItem([]).id).toMatch(/^t_[0-9a-f]{6}$/);
  });
});
