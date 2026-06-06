import { describe, it, expect } from 'vitest';
import { projectSchema, srsSchema, vtpSchema, SCHEMA_VERSION } from '../schema';

describe('v1 schema documents', () => {
  it('exposes the v1 schema version', () => {
    expect(SCHEMA_VERSION).toBe('1.0');
  });

  it('srs schema requires id and text per item', () => {
    expect(srsSchema.properties.items.items.required).toEqual(['id', 'text']);
  });

  it('vtp schema constrains result to the v1 enum', () => {
    expect(vtpSchema.properties.items.items.properties.result.enum).toEqual([
      '', 'not_tested', 'passed', 'failed',
    ]);
  });

  it('project schema requires a documents array', () => {
    expect(projectSchema.required).toContain('documents');
  });
});
