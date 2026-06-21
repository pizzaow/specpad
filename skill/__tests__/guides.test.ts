// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const guidesDir = fileURLToPath(new URL('../specpad/guides/', import.meta.url));
const skill = readFileSync(fileURLToPath(new URL('../specpad/SKILL.md', import.meta.url)), 'utf8');

const guideFiles = readdirSync(guidesDir).filter((f) => f.endsWith('.md'));
const referenced = Array.from(skill.matchAll(/guides\/([\w-]+\.md)/g)).map((m) => m[1]);

describe('on-demand authoring guides', () => {
  it('ships a guide for each document type', () => {
    expect(new Set(guideFiles)).toEqual(
      new Set(['requirements.md', 'tests.md', 'product-requirements.md', 'architecture.md']),
    );
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

  it('each guide covers what-to-capture and good/bad examples', () => {
    for (const f of guideFiles) {
      const body = readFileSync(guidesDir + f, 'utf8');
      expect(body, `${f} length`).toMatch(/[\s\S]{800,}/);
      expect(body, `${f} what-to-capture`).toMatch(/##\s*What to capture/i);
      expect(body, `${f} good example`).toContain('✅');
      expect(body, `${f} bad example`).toContain('❌');
    }
  });
});
