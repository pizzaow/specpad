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
    expect(skill).toMatch(/existing automated test/i);
    expect(skill).toMatch(/not_tested/);
    expect(skill).toMatch(/never omit|record(ing)? a gap|rather than omitting/i);
  });

  it('reports coverage rather than silently truncating', () => {
    expect(skill).toMatch(/report coverage/i);
    expect(skill).toMatch(/truncate silently|silently truncating/i);
  });

  it('drafts the full default set by default, registry-aware (BASE-6)', () => {
    expect(skill).toMatch(/full default (design-control )?set/i);
    expect(skill).toMatch(/PRD \+ SRS \+ VTP \+ SDD \+ a\s*\n?\s*starter SAD/i);
    expect(skill).toMatch(/registry-aware/i);
    expect(skill).toMatch(/declined|decline/i); // a type may be declined per project
  });

  it('works in passes, because one sweep finds only the observable surface', () => {
    // The cold-run comparison (JOB-57) showed a single sweep produces the API surface and
    // misses what the code refuses, the invariants, and intent.
    expect(skill).toMatch(/One pass is not enough/i);
    expect(skill).toMatch(/what the code refuses/i);
    expect(skill).toMatch(/tests as a source of intent/i);
    expect(skill).toMatch(/the invariants/i);
  });

  it('asks for the starter architecture and the safety class, which code cannot supply', () => {
    expect(skill).toMatch(/starter architecture/i);
    expect(skill).toMatch(/Do not skip this/i);   // §5.3 is unanswerable without it
    expect(skill).toMatch(/safety class and its rationale/i);
  });

  it('says plainly what a baseline cannot produce', () => {
    expect(skill).toMatch(/What a baseline cannot produce/i);
    expect(skill).toMatch(/rejected/i);
    expect(skill).toMatch(/not a substitute/i);
  });
});
