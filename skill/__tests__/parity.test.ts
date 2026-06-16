// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { GOVERNANCE_RULES } from '../../src/shared/governance';

describe('skill ↔ module governance parity', () => {
  const skill = readFileSync(new URL('../specpad/SKILL.md', import.meta.url), 'utf8');

  it('documents every governance rule id from the shared module', () => {
    for (const rule of GOVERNANCE_RULES) {
      expect(skill).toContain(rule.id);
    }
  });

  it('does not reference governance rule ids the module no longer defines', () => {
    const known = new Set<string>(GOVERNANCE_RULES.map((r) => r.id));
    const referenced = skill.match(/`(traceability|referential-integrity|missing-expected|active-job-open)`/g) ?? [];
    for (const token of referenced) {
      expect(known.has(token.replace(/`/g, ''))).toBe(true);
    }
  });
});
