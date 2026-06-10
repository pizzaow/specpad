import { describe, it, expect } from 'vitest';
import { renderReference } from '../generate-reference';
import { GOVERNANCE_RULES } from '../../../src/shared/governance';

describe('reference generator', () => {
  const html = renderReference();

  it('renders a field table for every document type', () => {
    for (const t of ['project', 'srs', 'vtp', 'releases', 'job']) {
      expect(html).toContain(`id="schema-${t}"`);
    }
  });

  it('includes every field with its description', () => {
    for (const probe of ['schemaVersion', 'verifies', 'expected', 'tagPattern', 'baseline', 'snapshot']) {
      expect(html).toContain(`<code>${probe}</code>`);
    }
    expect(html).toContain('ids, never codes');
  });

  it('includes every governance rule', () => {
    for (const rule of GOVERNANCE_RULES) {
      expect(html).toContain(rule.id);
      expect(html).toContain(rule.title);
    }
  });

  it('throws when a field lacks a description', () => {
    expect(() =>
      renderReference({
        schemas: { broken: { properties: { x: { type: 'string' } } } as never },
      }),
    ).toThrow(/description/i);
  });
});
