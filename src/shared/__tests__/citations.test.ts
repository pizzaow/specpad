import { describe, it, expect } from 'vitest';
import { parseCitation, checkCitations, isSourceCitation, type CitedItem } from '../citations';

const tree: Record<string, string> = {
  'src/shared/governance.ts': 'export function checkAdvice() {}\nconst RULES = [];\n',
  'docs/design/notes.md': ['a', 'b', 'c'].join('\n'),
};
const read = (p: string) => tree[p] ?? null;
const cite = (cites: string[]): CitedItem[] => [{ id: 'r_1', code: 'A-1', cites }];

describe('parseCitation', () => {
  it('recognises a bare repository path', () => {
    expect(parseCitation('src/shared/governance.ts')).toMatchObject({ kind: 'source', path: 'src/shared/governance.ts' });
  });

  it('recognises a construct anchor and a line anchor separately', () => {
    expect(parseCitation('src/shared/governance.ts:checkAdvice')).toMatchObject({ anchor: 'checkAdvice', anchorKind: 'symbol' });
    expect(parseCitation('src/shared/governance.ts:240')).toMatchObject({ anchor: '240', anchorKind: 'line' });
  });

  it('leaves a standards clause alone as external', () => {
    // Conservative on purpose: classifying a clause as a broken file reference would make
    // this the first check a project turns off.
    for (const raw of ['IEC 62304 §5.2.2 c)', 'FDA Cybersecurity (February 2026) §V.B.1', 'ISO 13485 §7.3.3']) {
      expect(parseCitation(raw).kind, raw).toBe('external');
      expect(isSourceCitation(raw)).toBe(false);
    }
  });

  it('treats a URL and an absolute path as external, not as repository source', () => {
    expect(parseCitation('https://example.com/spec.md').kind).toBe('external');
    expect(parseCitation('/etc/hosts.md').kind).toBe('external');
  });
});

describe('checkCitations', () => {
  it('says nothing when every citation resolves', () => {
    expect(checkCitations(cite(['src/shared/governance.ts:checkAdvice', 'IEC 62304 §5.2.2']), read)).toEqual([]);
  });

  it('reports a citation to a file that does not exist', () => {
    const [f] = checkCitations(cite(['src/shared/gone.ts']), read);
    expect(f.problem).toBe('missing-file');
    expect(f.message).toContain('does not exist');
  });

  it('reports a construct that has been renamed away', () => {
    // The event worth being told about: the citation was true when written and no longer is.
    const [f] = checkCitations(cite(['src/shared/governance.ts:checkTheThing']), read);
    expect(f.problem).toBe('missing-anchor');
    expect(f.message).toContain('renamed or removed');
  });

  it('warns that a line anchor will decay, even while it still resolves', () => {
    const [f] = checkCitations(cite(['docs/design/notes.md:2']), read);
    expect(f.problem).toBe('line-anchor');
    expect(f.message).toContain('cite the construct by name');
  });

  it('reports a line anchor past the end of the file as missing', () => {
    expect(checkCitations(cite(['docs/design/notes.md:99']), read)[0].problem).toBe('missing-anchor');
  });

  it('skips headings, which carry no evidence of their own', () => {
    expect(checkCitations([{ id: 'h_1', heading: true, cites: ['src/nope.ts'] }], read)).toEqual([]);
  });

  it('reads each file once however many requirements cite it', () => {
    let reads = 0;
    const counting = (p: string) => { reads += 1; return read(p); };
    const items: CitedItem[] = Array.from({ length: 5 }, (_, i) => ({ id: `r_${i}`, cites: ['src/shared/governance.ts:checkAdvice'] }));
    expect(checkCitations(items, counting)).toEqual([]);
    expect(reads).toBe(1);
  });
});
