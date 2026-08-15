import { describe, it, expect } from 'vitest';
import { featureSlugs, renderFeature } from '../generate-features';
import { GOVERNANCE_RULES } from '../../../src/shared/governance';
import { DOC_TYPES } from '../../../src/shared/docTypes';
import { REQUIREMENT_CATEGORIES, SECURITY_CONTROLS, SECURITY_TEST_TYPES } from '../../../src/shared/schema';

/**
 * The feature pages are generated from the live contract (JOB-58).
 *
 * The point is that the site cannot describe a rule set, a document type or a control
 * category the product does not have. A hand-written marketing page always reaches that
 * state eventually — it is the same failure that removed the references register and the
 * CLAUDE.md loop summary: a second copy is the one that goes stale.
 */
// Rendered here rather than read from disk: the generated pages are not committed, so a
// test that read them would pass only on a machine that had already built.
const slugs = featureSlugs();
const pages = new Map(slugs.map((s) => [s, renderFeature(s)]));
const read = (slug: string) => pages.get(slug)!;

describe('feature page generation', () => {
  it('renders a page for every template', () => {
    expect(slugs.length).toBeGreaterThanOrEqual(6);
    for (const slug of slugs) expect(read(slug).length, `${slug} rendered empty`).toBeGreaterThan(500);
  });

  it('leaves no placeholder unresolved', () => {
    // An unknown block fails the generator; this catches one that silently rendered empty.
    for (const slug of slugs) expect(read(slug), `${slug} has an unsubstituted block`).not.toMatch(/\{\{[a-z-]+\}\}/);
  });

  it('derives the governance rules from the module, every one of them', () => {
    const html = read('traceability');
    for (const rule of GOVERNANCE_RULES) {
      expect(html, `${rule.id} is missing from the traceability page`).toContain(rule.id);
    }
    expect(html).toContain(String(GOVERNANCE_RULES.length));
    // Tier is shown, so a reader can tell what actually blocks.
    expect(html).toMatch(/advisory/);
    expect(html).toMatch(/blocking/);
  });

  it('derives the document types from the registry', () => {
    const html = read('traceability');
    for (const d of DOC_TYPES) expect(html, `${d.type} is missing`).toContain(`<code>${d.type}</code>`);
  });

  it('derives the §5.2.2 categories and FDA control categories from the schema', () => {
    const compliance = read('compliance');
    for (const c of REQUIREMENT_CATEGORIES) expect(compliance, `${c.value} is missing`).toContain(c.label);
    const cyber = read('cybersecurity');
    for (const c of SECURITY_CONTROLS) expect(cyber, `${c.value} is missing`).toContain(c.label);
    for (const t of SECURITY_TEST_TYPES) expect(cyber, `${t.value} is missing`).toContain(t.value);
  });

  it('gives every page the shared chrome and a canonical URL', () => {
    for (const slug of slugs) {
      const html = read(slug);
      expect(html, `${slug} has no canonical`).toContain(`https://specpad.com/features/${slug}/`);
      expect(html, `${slug} has no header`).toContain('lp-header');
      expect(html, `${slug} has no footer`).toContain('lp-footer');
      expect(html, `${slug} does not link home`).toMatch(/href="\/"/);
    }
  });

  it('cross-links every page to the others, so no page is a dead end', () => {
    for (const slug of slugs) {
      const html = read(slug);
      for (const other of slugs.filter((s) => s !== slug)) {
        expect(html, `${slug} does not link to ${other}`).toContain(`/features/${other}/`);
      }
    }
  });
});
