import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Diagram resolution across prose documents (JOB-55).
 *
 * The security architecture carries figures the arc42 document never mentions. Scanning
 * only the architecture text left those references unresolved, which the reader saw as
 * "[diagram: …]" — a silent gap, since the markdown itself was correct.
 */

const files: Record<string, string> = {};
vi.mock('../fileApi', () => ({
  loadProjectText: vi.fn(async (name: string) => files[name] ?? null),
}));

const { loadDiagrams } = await import('../LocalApp');

beforeEach(() => {
  for (const k of Object.keys(files)) delete files[k];
  files['a.svg'] = '<svg id="a"/>';
  files['b.svg'] = '<svg id="b"/>';
  files['c.svg'] = '<svg id="c"/>';
});

describe('loadDiagrams', () => {
  it('resolves references from every prose source, not only the first', async () => {
    const sad = 'Architecture\n\n![One](a.svg)\n';
    const sec = 'Security\n\n![Two](b.svg)\n\n![Three](c.svg)\n';

    expect(Object.keys(await loadDiagrams(sad, sec)).sort()).toEqual(['a.svg', 'b.svg', 'c.svg']);
    // The regression: the security figures alone were never loaded.
    expect(Object.keys(await loadDiagrams(sad))).toEqual(['a.svg']);
  });

  it('loads a diagram shared by two documents once', async () => {
    const both = await loadDiagrams('![x](a.svg)', '![x](a.svg)');
    expect(Object.keys(both)).toEqual(['a.svg']);
  });

  it('ignores absent sources and omits a reference that does not resolve', async () => {
    const out = await loadDiagrams(null, undefined, '![gone](missing.svg)\n![here](a.svg)');
    // Omitted rather than empty-stringed: the renderer names what it cannot find.
    expect(out).toEqual({ 'a.svg': '<svg id="a"/>' });
  });
});
