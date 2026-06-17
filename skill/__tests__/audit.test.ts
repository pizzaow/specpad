// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const skill = readFileSync(new URL('../specpad/SKILL.md', import.meta.url), 'utf8');

// The requirement audit is an agent procedure (only the model can reconcile a
// spec against code); verification is that the distributable skill documents it.
describe('skill documents the requirement audit', () => {
  it('reconciles the spec against the whole codebase, noting the staged-diff form', () => {
    expect(skill).toMatch(/requirement audit/i);
    expect(skill).toMatch(/reconcile/i);
    expect(skill).toMatch(/whole codebase|whole-repo/i);
    expect(skill).toMatch(/staged diff/i);
  });

  it('categorizes findings as missing, stale, and coverage', () => {
    expect(skill).toMatch(/\bmissing\b/i);
    expect(skill).toMatch(/\bstale\b/i);
    expect(skill).toMatch(/\bcoverage\b/i);
  });

  it('proposes (never auto-applies) and never silently deletes a requirement', () => {
    expect(skill).toMatch(/propose/i);
    expect(skill).toMatch(/never auto-apply|nothing destructive/i);
    expect(skill).toMatch(/never silently delete/i);
  });

  it('reports coverage/confidence rather than truncating silently', () => {
    expect(skill).toMatch(/coverage\/confidence|report coverage/i);
    expect(skill).toMatch(/silently truncating/i);
  });
});
