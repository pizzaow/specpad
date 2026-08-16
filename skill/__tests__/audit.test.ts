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

  it('runs over the whole register, separately from a job, and gates a release (ADT-1)', () => {
    expect(skill).toMatch(/whole register at once/i);
    expect(skill).toMatch(/before cutting a release|before \*\*cutting a release\*\*/i);
  });

  it('puts the mechanical checks before any reading pass (ADT-2)', () => {
    expect(skill).toMatch(/mechanical, and always first/i);
    expect(skill).toMatch(/checkCitations/);
    // The order is the point: reading is the expensive part and must not be spent on what a
    // deterministic check can decide.
    expect(skill.indexOf('mechanical, and always first')).toBeLessThan(skill.indexOf('Stage 2'));
  });

  it('binds the reading passes with the quote-or-no-finding contract (ADT-3)', () => {
    expect(skill).toMatch(/must quote the current source that contradicts the claim/i);
    expect(skill).toMatch(/No quote, no finding/i);
    expect(skill).toMatch(/holds`?, `?contradicted|`holds`/);
    // Authoring advice is excluded, because it is unbounded and drowns the real findings.
    expect(skill).toMatch(/out of scope/i);
  });

  it('reads the register against itself for contradictions (ADT-4)', () => {
    expect(skill).toMatch(/register against itself/i);
    expect(skill).toMatch(/contradict/i);
  });

  it('reports coverage/confidence rather than truncating silently', () => {
    expect(skill).toMatch(/coverage\/confidence|report coverage/i);
    expect(skill).toMatch(/silently truncating/i);
  });
});
