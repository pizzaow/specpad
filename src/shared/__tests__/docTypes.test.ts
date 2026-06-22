import { describe, it, expect } from 'vitest';
import { REGISTER_TYPES, docTypeFor, isRegisterType, registerTypesInIndex } from '../docTypes';
import { validate } from '../validate';
import { diffItems } from '../diff';
import { classifyDocFilename } from '../../localFileApi';

describe('document-type registry', () => {
  it('describes each content document type with kind / schema / flags (REG-1)', () => {
    for (const t of ['srs', 'vtp', 'prd']) {
      const d = docTypeFor(t);
      expect(d, t).toBeDefined();
      expect(d!.kind, t).toBe('register');
      expect(d!.schema, `${t} schema`).toBeTruthy();
      expect(typeof d!.label, `${t} label`).toBe('string');
      expect(typeof d!.inBaseline).toBe('boolean');
      expect(['always', 'optional', 'never']).toContain(d!.generate);
    }
    expect(REGISTER_TYPES.every((d) => d.kind === 'register')).toBe(true);
    expect(isRegisterType('srs')).toBe(true);
    expect(isRegisterType('proj')).toBe(false);
  });

  it('validation is built from the registry — every register type validates, alongside the sidecars (REG-2)', () => {
    // Driven by DOC_TYPES: registering a new register type makes validate() accept it with no edit here.
    for (const d of REGISTER_TYPES) {
      const doc = { schemaVersion: '1.0', type: d.type, name: 'x', title: 'X', items: [] };
      expect(validate(doc), d.type).toEqual([]);
    }
    expect(validate({ schemaVersion: '1.0', type: 'project', name: 'x', title: 'X', documents: [] })).toEqual([]);
    expect(validate({ schemaVersion: '1.0', type: 'jobs', name: 'x', jobs: [] })).toEqual([]);
  });

  it('classifies every register type filename (and the project index) from the registry (REG-4)', () => {
    expect(classifyDocFilename('Acme.proj.json')?.type).toBe('proj');
    for (const d of REGISTER_TYPES) {
      expect(classifyDocFilename(`Acme.${d.type}.json`)?.type, d.type).toBe(d.type);
    }
    expect(classifyDocFilename('Acme.sad.md')).toBeNull();
  });

  it('any id-keyed register diffs via the shared diffItems — type-generic per-job/redline diff (REG-4)', () => {
    // A future SOUP/SDD/cyber register diffs the same way, with no bespoke code.
    const before = [{ id: 's_1', text: 'a' }];
    const after = [{ id: 's_1', text: 'b' }, { id: 's_2', text: 'new' }];
    const d = diffItems(before, after);
    expect(d.modified.map((m) => m.id)).toEqual(['s_1']);
    expect(d.added.map((a) => a.id)).toEqual(['s_2']);
  });

  it('registerTypesInIndex returns the register types present in a project index, in registry order', () => {
    expect(registerTypesInIndex(['srs', 'vtp']).map((d) => d.type)).toEqual(['srs', 'vtp']);
    expect(registerTypesInIndex(['prd', 'srs', 'vtp']).map((d) => d.type)).toEqual(['prd', 'srs', 'vtp']);
    expect(registerTypesInIndex(['proj']).map((d) => d.type)).toEqual([]);
  });
});
