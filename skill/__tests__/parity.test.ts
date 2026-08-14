// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { GOVERNANCE_RULES } from '../../src/shared/governance';
import {
  srsSchema, vtpSchema, prdSchema, sddSchema, threatSchema, soupSchema, riskSchema,
} from '../../src/shared/schema';

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

/**
 * Field-name parity between SKILL.md's "v1 shape" and the schemas.
 *
 * Added after the `tags` removal left `tags` documented in SKILL.md for a release, and the
 * baseline generator was still being told to mark drafts with a field that no longer
 * existed. Rule-id parity already existed; nothing checked field names.
 */
describe('skill ↔ schema field parity', () => {
  const skill = readFileSync(new URL('../specpad/SKILL.md', import.meta.url), 'utf8');
  const shape = skill.slice(skill.indexOf('## The v1 shape'), skill.indexOf('## Product requirements'));

  const SCHEMAS: Record<string, Record<string, unknown>> = {
    'SRS item': srsSchema, 'VTP item': vtpSchema, 'PRD item': prdSchema,
    'SDD section': sddSchema, 'Threat item': threatSchema, 'SOUP item': soupSchema, 'Risk item': riskSchema,
  };
  /** Values named inside a field list that are enum members, not field names. */
  const VALUES = new Set(['nominal', 'boundary', 'negative', 'stress', 'security', 'unit', 'view', 'markdown', 'STRIDE']);

  const propertiesOf = (schema: Record<string, unknown>) => {
    const items = (schema as { properties: { items: { items: { properties: Record<string, unknown> } } } }).properties.items.items;
    return new Set(Object.keys(items.properties));
  };

  for (const [label, schema] of Object.entries(SCHEMAS)) {
    it(`documents only fields the ${label} schema defines`, () => {
      const line = shape.slice(shape.indexOf(`${label} —`));
      const upto = line.indexOf('\n\n') >= 0 ? line.slice(0, line.indexOf('\n\n')) : line;
      const stanza = upto.split(/\n(?=[A-Z][A-Za-z]+ (item|section) —)/)[0];
      const named = [...stanza.matchAll(/`([A-Za-z][A-Za-z0-9_]*)`/g)].map((m) => m[1]).filter((f) => !VALUES.has(f));
      expect(named.length).toBeGreaterThan(0);
      const defined = propertiesOf(schema);
      for (const field of named) {
        expect(defined.has(field), `SKILL.md documents \`${field}\` on the ${label}, which the schema does not define`).toBe(true);
      }
    });
  }

  it('documents every required field of each item schema', () => {
    for (const [label, schema] of Object.entries(SCHEMAS)) {
      const items = (schema as { properties: { items: { items: { required: string[] } } } }).properties.items.items;
      for (const field of items.required ?? []) {
        expect(shape, `${label} does not document its required field \`${field}\``).toMatch(new RegExp(`\`${field}\``));
      }
    }
  });
});
