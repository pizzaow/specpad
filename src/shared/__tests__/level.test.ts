import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import { createSrsItem, createVtpItem } from '../factories';
import type { SrsDoc } from '../schema';

function srsWith(items: SrsDoc['items']): SrsDoc {
  return { schemaVersion: '1.0', type: 'srs', name: 'A', title: 'T', items };
}

describe('level field', () => {
  it('accepts an item with a non-negative integer level', () => {
    expect(validate(srsWith([{ id: 'r_1', text: 'x', level: 2 }]))).toEqual([]);
  });
  it('accepts an item with no level (defaults to flat)', () => {
    expect(validate(srsWith([{ id: 'r_1', text: 'x' }]))).toEqual([]);
  });
  it('rejects a non-integer level', () => {
    expect(validate(srsWith([{ id: 'r_1', text: 'x', level: 1.5 } as never])).length).toBeGreaterThan(0);
  });
  it('rejects a negative level', () => {
    expect(validate(srsWith([{ id: 'r_1', text: 'x', level: -1 } as never])).length).toBeGreaterThan(0);
  });

  it('createSrsItem omits level by default and sets it when > 0', () => {
    expect(createSrsItem([]).level).toBeUndefined();
    expect(createSrsItem([], 2).level).toBe(2);
  });
  it('createVtpItem sets level when > 0', () => {
    expect(createVtpItem([]).level).toBeUndefined();
    expect(createVtpItem([], 1).level).toBe(1);
  });
});
