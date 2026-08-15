/**
 * Generates the feature pages from templates plus the LIVE contract module.
 *
 * Anything the product already knows — the governance rules and their tiers, the document
 * types, FDA's security control categories, the §5.2.2 requirement categories, the test
 * kinds and security testing types — is injected here rather than retyped into HTML. The
 * site is then incapable of describing a rule set the product does not have, which is the
 * failure mode a hand-written marketing page always eventually reaches.
 *
 * Prose stays hand-written in the templates. Run via: tsx site/src/generate-features.ts
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import { GOVERNANCE_RULES } from '../../src/shared/governance';
import { DOC_TYPES } from '../../src/shared/docTypes';
import {
  REQUIREMENT_CATEGORIES, SECURITY_CONTROLS, SECURITY_TEST_TYPES, TEST_KINDS, TEST_LEVELS,
} from '../../src/shared/schema';

const here = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(here, '..');

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const rows = (cells: string[][]): string =>
  cells.map((r) => `          <tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n');

/* ── Blocks the templates can ask for by name ──────────────────────────────── */
const BLOCKS: Record<string, () => string> = {
  'governance-rules': () => {
    const tier = (t?: string) => (t === 'advisory' ? '<span class="lp-tag lp-tag-soft">advisory</span>' : '<span class="lp-tag">blocking</span>');
    return rows(GOVERNANCE_RULES.map((r) => [`<code>${esc(r.id)}</code>`, esc(r.title), tier(r.tier)]));
  },
  'governance-count': () => String(GOVERNANCE_RULES.length),
  'governance-blocking-count': () => String(GOVERNANCE_RULES.filter((r) => r.tier !== 'advisory').length),
  'governance-advisory-count': () => String(GOVERNANCE_RULES.filter((r) => r.tier === 'advisory').length),

  'document-types': () => rows(
    DOC_TYPES.map((d) => [
      `<code>${esc(d.type)}</code>`,
      esc(d.label),
      d.kind === 'register' ? 'register' : 'prose',
      d.optional ? 'optional' : 'required',
    ]),
  ),
  'document-type-count': () => String(DOC_TYPES.length),

  'requirement-categories': () => rows(
    REQUIREMENT_CATEGORIES.map((c) => [`<code>${esc(c.letter)})</code>`, esc(c.label), esc(c.text)]),
  ),
  'security-controls': () => rows(
    SECURITY_CONTROLS.map((c) => [esc(c.label), esc(c.text)]),
  ),
  'security-test-types': () => {
    const byGroup = new Map<string, string[]>();
    for (const t of SECURITY_TEST_TYPES) byGroup.set(t.group, [...(byGroup.get(t.group) ?? []), t.value]);
    return rows([...byGroup].map(([group, types]) => [
      esc(group),
      types.map((t) => `<code>${esc(t)}</code>`).join(' '),
    ]));
  },
  'test-kinds': () => rows(TEST_KINDS.map((k) => [`<code>${esc(k.value)}</code>`, esc(k.text)])),
  'test-levels': () => rows(TEST_LEVELS.map((l) => [`<code>${esc(l.value)}</code>`, esc(l.label)])),
};

/* ── Render ────────────────────────────────────────────────────────────────── */

/** The slugs a page exists for, from the templates on disk. */
export function featureSlugs(): string[] {
  return fs.readdirSync(path.join(here, 'features'))
    .filter((f) => f.endsWith('.template.html'))
    .map((f) => f.replace('.template.html', ''));
}

/**
 * Render one page. Exported so it can be tested without the build having run — the
 * generated files are not committed, and a test that reads them would pass only on a
 * machine that had already built.
 */
export function renderFeature(slug: string): string {
  const src = fs.readFileSync(path.join(here, 'features', `${slug}.template.html`), 'utf8');
  return src.replace(/\{\{([a-z-]+)\}\}/g, (_m, name: string) => {
    const block = BLOCKS[name];
    if (!block) throw new Error(`site/src/features/${slug}.template.html: unknown generated block {{${name}}}`);
    return block();
  });
}

/** Written only when run as the build step, not on import. */
function main(): void {
  const slugs = featureSlugs();
  if (!slugs.length) {
    console.error('No feature templates found in site/src/features/');
    process.exit(1);
  }
  for (const slug of slugs) {
    const dir = path.join(siteDir, 'features', slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderFeature(slug));
  }
  console.log(`Generated ${slugs.length} feature page(s) from the live contract.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
