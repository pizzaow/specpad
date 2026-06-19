// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const skill = readFileSync(new URL('../specpad/SKILL.md', import.meta.url), 'utf8');
const sad = readFileSync(new URL('../../docs/specpad/specpad.sad.md', import.meta.url), 'utf8');
const docPath = (f: string) => new URL(`../../docs/specpad/${f}`, import.meta.url);

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

const tpl = (f: string) => readFileSync(new URL(`../specpad/templates/${f}`, import.meta.url), 'utf8');

describe('architecture profiles & templates', () => {
  it('ships generic and medical SAD templates with the right sections', () => {
    const generic = tpl('sad.generic.md');
    const medical = tpl('sad.medical.md');
    expect(generic).toMatch(/arc42/i);
    expect(medical).toMatch(/Safety classification & segregation/);
    expect(medical).toMatch(/Architecture Verification/);
    // generic has no per-unit classification sections
    expect(generic).not.toMatch(/Safety classification & segregation/);
    expect(generic).not.toMatch(/Architecture Verification/);
  });

  it('ships a multi-view C4 workspace template and per-profile authoring guides', () => {
    const w = tpl('workspace.dsl');
    expect(w).toMatch(/systemContext/);
    expect(w).toMatch(/container /);
    expect(() => tpl('sad.guide.generic.md')).not.toThrow();
    expect(() => tpl('sad.guide.medical.md')).not.toThrow();
  });

  it('documents the init medical/generic quiz and reading the guide', () => {
    expect(skill).toMatch(/medical.*device project|medical.*or.*generic/i);
    expect(skill).toMatch(/sad\.generic\.md/);
    expect(skill).toMatch(/sad\.medical\.md/);
    expect(skill).toMatch(/reads\s+it\s+before\s+editing\s+the\s+SAD/i);
  });

  it('documents draw.io SVG diagrams, coarse change tracking, and the Edit/Display view', () => {
    expect(skill).toMatch(/draw\.io/i);
    expect(skill).toMatch(/\.context\.svg|SVG export/i);
    expect(skill).toMatch(/coarse/i);
    expect(skill).toMatch(/Edit.*Display|Display.*sub-tabs?/i);
  });
});

describe('SpecPad dogfoods its own architecture spec', () => {
  it('has a non-empty arc42 SAD with section headings', () => {
    expect(sad.length).toBeGreaterThan(200);
    expect(sad).toMatch(/^##\s+1\. Introduction and Goals/m);
    expect(sad).toMatch(/^##\s+12\. Glossary/m);
  });

  it('places multiple diagrams via markdown image refs, and the SVGs exist and render', () => {
    const refs = [...sad.matchAll(/!\[[^\]]*\]\(([^)]+\.svg)\)/g)].map((m) => m[1]);
    // Context (overview), building block, runtime, deployment.
    expect(refs.length).toBeGreaterThanOrEqual(4);
    expect(refs).toContain('specpad.context.svg');
    for (const ref of refs) {
      const svg = readFileSync(docPath(ref), 'utf8');
      expect(svg).toMatch(/<svg/);
    }
  });

  it('no longer ships the optional C4 DSL in the dogfood (it is opt-in via the template)', () => {
    expect(existsSync(docPath('specpad.workspace.dsl'))).toBe(false);
    expect(() => tpl('workspace.dsl')).not.toThrow(); // template kept for opt-in
  });
});
