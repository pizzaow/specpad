import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * SpecPad's own security architecture views (JOB-55, dogfood).
 *
 * The FDA cybersecurity guidance (3 February 2026, §V.B.2 and Appendix 2) expects each view
 * to carry a diagram as well as prose, every communication path to say what traverses it,
 * and the reader to be able to follow it. The Positron draw.io style guide v2.2 fixes how
 * that is drawn. Both are checked here rather than trusted, because a figure degrades
 * quietly: an unlabelled arrow still renders.
 */

const docs = resolve(__dirname, '../../../docs/specpad');
const read = (f: string) => readFileSync(resolve(docs, f), 'utf8');
const sec = read('specpad.sec.md');

const FIGURES = [...sec.matchAll(/!\[[^\]]*\]\(([^)]+\.svg)\)/g)].map((m) => m[1]);

// The style guide's four semantic fills, plus the canvas and text colours it fixes.
const PALETTE = new Set([
  '#FEFEFE', '#FAFAFA', '#F5F3FF', '#E5E7EB', '#FFF1F2',
  '#64748B', '#8B5CF6', '#E11D48', '#1E293B', '#0F172A', '#475569', '#94A3B8',
]);

describe('security architecture views', () => {
  it('covers all four view types the guidance names', () => {
    for (const view of [/global system view/i, /multi-patient harm/i, /updateability and patchability/i, /security use case/i]) {
      expect(sec).toMatch(view);
    }
  });

  it('provides more than one global system view, as the attack surface requires', () => {
    // The guidance allows extra views rather than one crowded diagram; SpecPad's two
    // deployments differ enough in exposure that one figure would misrepresent both.
    const globals = [...sec.matchAll(/^## \d+\. Global system view/gm)];
    expect(globals.length).toBeGreaterThan(1);
  });

  it('gives every view a diagram, not prose alone', () => {
    expect(FIGURES.length).toBeGreaterThanOrEqual(6);
    for (const f of FIGURES) expect(existsSync(resolve(docs, f)), `${f} is referenced but absent`).toBe(true);
  });

  it('documents each communication path with what it carries and what protects it', () => {
    for (const heading of ['Carries', 'Protocol', 'Authenticated by', 'Authorized by', 'Threats', 'Controls']) {
      expect(sec).toContain(heading);
    }
    // Appendix 2 asks for these once per view; they are the details a table cannot hold.
    for (const topic of [/unused interface/i, /handoff/i, /cryptograph/i, /session/i]) {
      expect(sec).toMatch(topic);
    }
  });

  it('cites the guidance in force rather than a superseded edition', () => {
    expect(sec).toMatch(/3 February 2026/);
    // The June 2025 edition may be named, but only as the one that was superseded.
    for (const m of [...sec.matchAll(/June 2025/g)]) {
      expect(sec.slice(Math.max(0, m.index! - 40), m.index!)).toMatch(/supersedes the\s+$/);
    }
  });

  describe.each(FIGURES)('%s', (file) => {
    const svg = read(file);

    it('fits the canvas the style guide allows', () => {
      const w = Number(/width="(\d+)"/.exec(svg)?.[1]);
      const h = Number(/height="(\d+)"/.exec(svg)?.[1]);
      expect(w).toBeLessThanOrEqual(900);
      expect(h).toBeLessThanOrEqual(1100);
    });

    it('sets Arial and no text below 11px', () => {
      expect(svg).toContain('font-family="Arial');
      const sizes = [...svg.matchAll(/font-size="(\d+)"/g)].map((m) => Number(m[1]));
      expect(sizes.length).toBeGreaterThan(0);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11);
    });

    it('uses only the palette', () => {
      for (const c of [...svg.matchAll(/#[0-9A-Fa-f]{6}/g)].map((m) => m[0].toUpperCase())) {
        expect(PALETTE.has(c), `${c} is outside the palette`).toBe(true);
      }
    });

    it('carries a legend', () => {
      expect(svg).toContain('>Legend<');
    });

    it('labels every connector', () => {
      // Each arrow-terminated path must have a label; an unlabelled arrow says two things
      // are connected and nothing else. Lane rules carry no marker and are not connectors.
      const arrows = (svg.match(/marker-end="url\(#arw\)"/g) || []).length;
      const labels = (svg.match(/font-size="11" fill="#475569"/g) || []).length;
      expect(arrows).toBeGreaterThan(0);
      expect(labels).toBeGreaterThanOrEqual(arrows - 3); // legend keys carry no label
    });
  });
});
