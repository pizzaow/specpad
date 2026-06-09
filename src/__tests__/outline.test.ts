import { describe, it, expect } from 'vitest';
import { deriveHeadingCodes } from '../outline';
import type { SrsItem } from '../shared';

const h = (id: string, text: string, level: number, code?: string): SrsItem => ({
  id, text, heading: true, level, ...(code ? { code } : {}),
});
const r = (id: string, level = 0): SrsItem => ({ id, text: 'req', level });

describe('deriveHeadingCodes', () => {
  it('uses a heading code segment at the top level', () => {
    const m = deriveHeadingCodes([h('h1', 'Data section', 0, 'Data')]);
    expect(m.get('h1')).toBe('Data');
  });

  it('joins ancestor segments with dots for nested headings', () => {
    const m = deriveHeadingCodes([
      h('h1', 'Data', 0, 'Data'),
      h('h2', 'Range', 1, 'Range'),
    ]);
    expect(m.get('h1')).toBe('Data');
    expect(m.get('h2')).toBe('Data.Range');
  });

  it('pops the stack when returning to a shallower level', () => {
    const m = deriveHeadingCodes([
      h('h1', 'Data', 0, 'Data'),
      h('h2', 'Range', 1, 'Range'),
      h('h3', 'Other', 0, 'Other'),
    ]);
    expect(m.get('h3')).toBe('Other');
  });

  it('falls back to the first word of the text when a heading has no code', () => {
    const m = deriveHeadingCodes([h('h1', 'Stable identity and references', 0)]);
    expect(m.get('h1')).toBe('Stable');
  });

  it('ignores non-heading requirements', () => {
    const m = deriveHeadingCodes([h('h1', 'Data', 0, 'Data'), r('r1', 1)]);
    expect(m.has('r1')).toBe(false);
    expect(m.size).toBe(1);
  });

  it('treats a missing level as 0', () => {
    const m = deriveHeadingCodes([
      { id: 'h1', text: 'Data', heading: true, code: 'Data' },
      { id: 'h2', text: 'More', heading: true, code: 'More' },
    ]);
    expect(m.get('h2')).toBe('More');
  });
});
