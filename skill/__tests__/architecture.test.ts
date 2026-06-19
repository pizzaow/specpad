// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const skill = readFileSync(new URL('../specpad/SKILL.md', import.meta.url), 'utf8');
const sad = readFileSync(new URL('../../docs/specpad/specpad.sad.md', import.meta.url), 'utf8');
const dsl = readFileSync(new URL('../../docs/specpad/specpad.workspace.dsl', import.meta.url), 'utf8');

describe('skill documents the architecture spec', () => {
  it('documents the arc42 + C4 tracked files as a separate optional spec', () => {
    expect(skill).toMatch(/arc42/i);
    expect(skill).toMatch(/\.sad\.md/);
    expect(skill).toMatch(/\.workspace\.dsl/);
    expect(skill).toMatch(/Structurizr/i);
  });

  it('documents job/release coupling and no requirement↔architecture matrix', () => {
    expect(skill).toMatch(/job\/release-level|job\/release-coupled/i);
    expect(skill).toMatch(/requirement↔architecture|requirement-to-architecture|requirement.architecture trace/i);
  });

  it('documents snapshotting the architecture docs into the caches on close', () => {
    expect(skill).toMatch(/snapshot/i);
    expect(skill).toMatch(/per-job cache|release baseline/i);
  });
});

describe('SpecPad dogfoods its own architecture spec', () => {
  it('has a non-empty arc42 SAD with section headings', () => {
    expect(sad.length).toBeGreaterThan(200);
    expect(sad).toMatch(/^##\s+1\. Introduction and Goals/m);
    expect(sad).toMatch(/^##\s+12\. Glossary/m);
  });

  it('has a Structurizr workspace with model and views', () => {
    expect(dsl).toMatch(/workspace "SpecPad"/);
    expect(dsl).toMatch(/model\s*\{/);
    expect(dsl).toMatch(/views\s*\{/);
  });
});
