// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const skill = readFileSync(new URL('../specpad/SKILL.md', import.meta.url), 'utf8');

// The "primary capture" mechanism is an agent-behavior protocol — only the model
// can distill intent. Its verification is therefore that the distributable skill
// documents the loop (the same shape as change-tracking.test.ts).
describe('skill documents the SpecPad working loop (primary capture)', () => {
  it('describes capturing requirements as you build, spec-first', () => {
    expect(skill).toMatch(/working loop/i);
    expect(skill).toMatch(/spec-first/i);
    expect(skill).toMatch(/requirement → VTP|job → requirement/i);
  });

  it('gives distillation guidance (intent not transcript; testable behavioral rules)', () => {
    expect(skill).toMatch(/intent, not transcript/i);
    expect(skill).toMatch(/rises to a requirement/i);
    expect(skill).toMatch(/fails if this behavior regressed/i);
  });

  it('states capture is autonomous but surfaced for correction', () => {
    expect(skill.toLowerCase()).toContain('autonomous');
    expect(skill).toMatch(/edit after|correct granularity/i);
  });

  it('directs the job to evaluate impact across every registered document type, naming PRD + architecture (REG-5)', () => {
    expect(skill).toMatch(/every registered document type/i);
    // not just SRS/VTP — the user-facing intent (PRD) and structural (architecture/SAD) types are called out
    expect(skill).toMatch(/PRD/);
    expect(skill).toMatch(/architecture|SAD/i);
    // the CLAUDE.specpad.md project-memory template mirrors the same instruction
    const template = readFileSync(new URL('../specpad/templates/CLAUDE.specpad.md', import.meta.url), 'utf8');
    expect(template).toMatch(/every registered document type/i);
    expect(template).toMatch(/architecture/i);
  });
});
