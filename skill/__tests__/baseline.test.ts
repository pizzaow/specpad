// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const skill = readFileSync(new URL('../specpad/SKILL.md', import.meta.url), 'utf8');

// The baseline generator is an agent procedure (only the model can distill a
// spec from code); its verification is that the distributable skill documents
// the procedure and its load-bearing principles.
describe('skill documents the baseline generator', () => {
  it('describes drafting a spec from an existing codebase, including its tests', () => {
    expect(skill).toMatch(/baseline generator/i);
    expect(skill).toMatch(/existing codebase/i);
    expect(skill).toMatch(/existing tests/i);
  });

  it('states output is a draft for ratification, tagged draft, not authoritative', () => {
    expect(skill).toMatch(/draft for human ratification/i);
    expect(skill).toMatch(/never\s+authoritative/i);
    expect(skill).toMatch(/`draft`/);
  });

  it('keeps requirements at the "shall" altitude and governance-clean', () => {
    expect(skill).toMatch(/"shall" altitude/i);
    expect(skill).toMatch(/implementation detail/i);
    expect(skill).toMatch(/governance-clean/i);
  });

  it('maps to existing tests and records gaps as not_tested rather than omitting', () => {
    expect(skill).toMatch(/map to tests/i);
    expect(skill).toMatch(/not_tested/);
    expect(skill).toMatch(/never omit|record the gap/i);
  });

  it('reports coverage rather than silently truncating', () => {
    expect(skill).toMatch(/report coverage/i);
    expect(skill).toMatch(/silently truncating/i);
  });

  it('drafts the full default set — PRD and a starter architecture — by default, registry-aware (BASE-6)', () => {
    expect(skill).toMatch(/full default (design-control )?set/i);
    expect(skill).toMatch(/Draft a PRD \(default\)/i);
    expect(skill).toMatch(/Draft a starter architecture \(default\)/i);
    expect(skill).toMatch(/registry-aware/i);
    expect(skill).toMatch(/declined|decline/i); // a type may be declined per project
  });
});
