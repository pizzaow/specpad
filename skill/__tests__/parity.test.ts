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
    // Matched by namespace rather than by a fixed list of five legacy names: the old
    // pattern never looked at the prd-, sdd-, risk-, soup- or threat- rules, so SKILL.md
    // documented `soup-anomalies` for a release after the rule was removed and this test
    // stayed green (found by the IEC 62304 trace, JOB-51).
    // Gates the skill enforces itself, which are deliberately not in the data-only set the
    // editor runs because they need git state rather than the documents alone.
    const skillSideGates = new Set(['active-job-required-for-spec-changes']);
    const referenced =
      skill.match(/`(traceability|referential-integrity|missing-expected|(?:active-job|prd|sdd|risk|soup|threat)-[a-z-]+)`/g) ?? [];
    expect(referenced.length).toBeGreaterThan(0);
    for (const token of referenced) {
      const id = token.replace(/`/g, '');
      if (skillSideGates.has(id)) continue;
      expect(known.has(id), `SKILL.md documents "${id}", which the module does not define`).toBe(true);
    }
  });
});
