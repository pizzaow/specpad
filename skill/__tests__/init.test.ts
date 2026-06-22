// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../specpad/${rel}`, import.meta.url)), 'utf8');
const skill = read('SKILL.md');

describe('specpad init', () => {
  it('documents the one-step init procedure and its artifacts', () => {
    expect(skill).toMatch(/Initialize SpecPad|specpad init/i);
    expect(skill).toContain('core.hooksPath');
    expect(skill).toMatch(/CLAUDE\.md/);
    expect(skill).toMatch(/idempotent/i);
    // the artifacts init installs must ship with the skill
    expect(existsSync(fileURLToPath(new URL('../specpad/templates/hooks/pre-push', import.meta.url)))).toBe(true);
    expect(existsSync(fileURLToPath(new URL('../specpad/templates/CLAUDE.specpad.md', import.meta.url)))).toBe(true);
  });

  it('ships a CLAUDE directive carrying the idempotency sentinel and the loop', () => {
    const tpl = read('templates/CLAUDE.specpad.md');
    expect(tpl).toContain('<!-- specpad:working-loop -->');
    expect(tpl).toMatch(/spec-first/i);
    expect(tpl).toMatch(/active open job/i);
  });

  it('scaffolds the full default document set, including the PRD register (INIT-4)', () => {
    expect(skill).toMatch(/full default set/i);
    // the PRD scaffold template ships and is listed in the starter project index
    const proj = read('templates/starter.proj.json');
    expect(proj).toMatch(/"type":\s*"prd"/);
    const prd = JSON.parse(read('templates/starter.prd.json'));
    expect(prd.type).toBe('prd');
    expect(Array.isArray(prd.items)).toBe(true);
  });

  it('documents safe, non-destructive re-runs', () => {
    expect(skill).toMatch(/never overwrite/i);     // existing docs / CLAUDE.md
    expect(skill).toMatch(/append/i);              // CLAUDE.md is appended, not replaced
    expect(skill).toMatch(/sentinel/i);            // dedupe guard
    expect(skill).toMatch(/do not clobber/i);      // existing core.hooksPath
  });
});
