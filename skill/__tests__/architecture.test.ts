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

describe('architecture profile & templates', () => {
  it('ships ONE SAD template, and it carries the regulated sections (JOB-61)', () => {
    // SpecPad is a medical-device offering: there is no generic/medical branch to choose
    // between. The split cost two templates that drifted while core already carried safety
    // classification, risk, SOUP and the threat model.
    const sad = tpl('sad.md');
    expect(sad).toMatch(/arc42/i);
    expect(sad).toMatch(/Safety classification & segregation/);
    expect(sad).toMatch(/Architecture Verification/);
    expect(() => tpl('sad.guide.md')).not.toThrow();
    // The profile-suffixed templates are gone, not merely unreferenced.
    for (const gone of ['sad.generic.md', 'sad.guide.generic.md', 'sec.generic.md']) {
      expect(() => tpl(gone), `${gone} still ships`).toThrow();
    }
  });

  it('ships a multi-view C4 workspace template, which init does not scaffold', () => {
    const w = tpl('workspace.dsl');
    expect(w).toMatch(/systemContext/);
    expect(w).toMatch(/container /);
    expect(skill).toMatch(/opt-in\*{0,2} and is not scaffolded|is \*\*opt-in\*\* and is not scaffolded/i);
  });

  it('asks for the safety class rather than asking what kind of project this is', () => {
    expect(skill).toMatch(/What software safety class, and why\?/);
    expect(skill).toMatch(/safetyClassRationale/);
    expect(skill).toMatch(/reads\s+it\s+before\s+editing\s+the\s+SAD/i);
    // No profile branch survives anywhere in the skill.
    expect(skill).not.toMatch(/specpad-medical/);
    expect(skill).not.toMatch(/sad\.generic\.md/);
  });

  it('states the medical aim, and keeps classification a convention not a schema field', () => {
    expect(skill).toMatch(/aimed at medical devices/i);
    expect(skill).toMatch(/one skill and\s*\n?one profile|one profile/i);
    expect(skill).toMatch(/Classification is a convention, not a hard-coded field/i);
    expect(skill).toMatch(/per software unit/i);
    expect(skill).toMatch(/Basic\/Enhanced/);
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
