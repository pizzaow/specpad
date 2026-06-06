import { describe, it, expect } from 'vitest';
import { generateId } from '../ids';

describe('generateId', () => {
  it('produces a prefixed 6-hex-digit slug', () => {
    const id = generateId('r', [], () => 0.5);
    expect(id).toMatch(/^r_[0-9a-f]{6}$/);
  });

  it('is deterministic given a fixed rng', () => {
    expect(generateId('t', [], () => 0)).toBe('t_000000');
  });

  it('skips ids already taken', () => {
    const rng = makeSequenceRng([0, 0, 0.5]);
    const id = generateId('r', ['r_000000'], rng);
    expect(id).not.toBe('r_000000');
    expect(id).toMatch(/^r_[0-9a-f]{6}$/);
  });

  it('accepts a Set of existing ids', () => {
    const id = generateId('h', new Set(['h_000000']), makeSequenceRng([0, 0.25]));
    expect(id).not.toBe('h_000000');
  });

  it('throws if it cannot find a free id', () => {
    expect(() => generateId('r', ['r_000000'], () => 0)).toThrow();
  });
});

function makeSequenceRng(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}
