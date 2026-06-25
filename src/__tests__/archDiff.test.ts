import { describe, it, expect } from 'vitest';
import { mdSectionDiff } from '../archDiff';

const doc = (body: string) => body.replace(/^\n/, '');

describe('mdSectionDiff', () => {
  it('reports only the sections that changed, by heading, with +/- lines', () => {
    const before = doc(`
# Title
intro line
## 1. Goals
goal a
goal b
## 2. Decisions
keep this
`);
    const after = doc(`
# Title
intro line
## 1. Goals
goal a
goal b
## 2. Decisions
keep this
a new decision
`);
    const d = mdSectionDiff(before, after);
    expect(d).toHaveLength(1);
    expect(d[0].heading).toBe('2. Decisions');
    expect(d[0].status).toBe('modified');
    expect(d[0].added).toEqual(['a new decision']);
    expect(d[0].removed).toEqual([]);
  });

  it('flags added and removed sections', () => {
    const before = doc(`## A\nx\n## Gone\nold`);
    const after = doc(`## A\nx\n## New\nfresh`);
    const d = mdSectionDiff(before, after);
    const byHeading = Object.fromEntries(d.map((s) => [s.heading, s]));
    expect(byHeading['New'].status).toBe('added');
    expect(byHeading['New'].added).toEqual(['fresh']);
    expect(byHeading['Gone'].status).toBe('removed');
    expect(byHeading['Gone'].removed).toEqual(['old']);
    expect(byHeading['A']).toBeUndefined(); // unchanged sections are omitted
  });

  it('attributes preamble changes to the (intro) section', () => {
    const d = mdSectionDiff(doc(`lead in\n## A\nx`), doc(`lead in changed\n## A\nx`));
    expect(d).toHaveLength(1);
    expect(d[0].heading).toBe('(intro)');
    expect(d[0].added).toEqual(['lead in changed']);
    expect(d[0].removed).toEqual(['lead in']);
  });

  it('returns nothing for identical documents', () => {
    expect(mdSectionDiff('## A\nsame\n', '## A\nsame\n')).toEqual([]);
  });
});
