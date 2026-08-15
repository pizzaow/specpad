// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const guidesDir = fileURLToPath(new URL('../specpad/guides/', import.meta.url));
const skill = readFileSync(fileURLToPath(new URL('../specpad/SKILL.md', import.meta.url)), 'utf8');

const guideFiles = readdirSync(guidesDir).filter((f) => f.endsWith('.md'));
const referenced = Array.from(skill.matchAll(/guides\/([\w-]+\.md)/g)).map((m) => m[1]);

/**
 * Two kinds of guide. A DOCUMENT guide teaches what to put in one register and is held to a
 * fixed shape (what to capture, good and bad examples). A PROCESS guide teaches an activity
 * that spans registers — reviewing what was just written — and has no "what to capture"
 * because it captures nothing.
 */
const DOCUMENT_GUIDES = [
  'requirements.md', 'tests.md', 'product-requirements.md', 'architecture.md',
  'detailed-design.md', 'risk.md', 'soup.md', 'security.md',
];
const PROCESS_GUIDES = ['review-passes.md'];

describe('on-demand authoring guides', () => {
  it('ships a guide for each document type, and for each cross-cutting process', () => {
    expect(new Set(guideFiles)).toEqual(new Set([...DOCUMENT_GUIDES, ...PROCESS_GUIDES]));
  });

  it('SKILL.md routes to each guide by path (and the routing stays in sync)', () => {
    // Every shipped guide is referenced, and every referenced guide exists — no orphans, no dangling.
    expect(new Set(referenced)).toEqual(new Set(guideFiles));
  });

  it('keeps the guide bodies out of SKILL.md (routing pointer, not inlined content)', () => {
    // The example headings live only in the guides; finding them in SKILL.md means a guide got inlined.
    expect(skill).not.toContain('✅ Good examples');
    expect(skill).not.toContain('## What to capture');
  });

  it('each document guide covers what-to-capture and good/bad examples', () => {
    for (const f of DOCUMENT_GUIDES) {
      const body = readFileSync(guidesDir + f, 'utf8');
      expect(body, `${f} length`).toMatch(/[\s\S]{800,}/);
      expect(body, `${f} what-to-capture`).toMatch(/##\s*What to capture/i);
      expect(body, `${f} good example`).toContain('✅');
      expect(body, `${f} bad example`).toContain('❌');
    }
  });

  it('each process guide states its failure modes, since it has no fixed shape', () => {
    for (const f of PROCESS_GUIDES) {
      const body = readFileSync(guidesDir + f, 'utf8');
      expect(body, `${f} length`).toMatch(/[\s\S]{800,}/);
      expect(body, `${f} failure modes`).toContain('❌');
    }
  });
});
