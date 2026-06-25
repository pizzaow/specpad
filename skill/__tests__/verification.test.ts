// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// SKILL.md prose wraps; multi-word phrases use \s+ (never literal spaces).
const skill = readFileSync(new URL('../specpad/SKILL.md', import.meta.url), 'utf8');

describe('skill documents verification runs (VTP -> test -> run)', () => {
  it('has a Verification runs section describing the chain', () => {
    expect(skill).toMatch(/Verification\s+runs/i);
    expect(skill).toMatch(/VTP\s+item\s+→\s+the\s+automated\s+test/i);
  });

  it('describes framework-agnostic automation linkage on the VTP item', () => {
    expect(skill).toMatch(/automation:\s*\[\{\s*runner,\s*file,\s*selector/i);
    expect(skill).toMatch(/framework-agnostic/i);
    expect(skill).toMatch(/opaque/i);
  });

  it('describes a normalized run record captured via an adapter (vitest) or CI', () => {
    expect(skill).toMatch(/`run`\s+sidecar/i);
    expect(skill).toMatch(/vitest\s+adapter/i);
    expect(skill).toMatch(/CI\s+emits\s+the\s+same\s+normalized/i);
    expect(skill).toMatch(/never\s+parses\s+a\s+test\s+framework/i);
  });

  it('derives automated results and keeps manual results', () => {
    expect(skill).toMatch(/derives\s+each\s+automated\s+test's\s+result/i);
    expect(skill).toMatch(/Manual\s+tests\s+fall\s+back\s+to\s+their\s+stored/i);
  });

  it('freezes the run for key deliverables (release baseline + closed job after)', () => {
    expect(skill).toMatch(/Freeze\s+for\s+key\s+deliverables/i);
    expect(skill).toMatch(/release\s+baseline/i);
    expect(skill).toMatch(/`after\/`/i);
  });
});
