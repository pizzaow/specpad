# Marketing Site Implementation Plan (Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A landing page at `specpad.com/`, a build-time-generated schema reference at `specpad.com/reference/`, a downloadable skill zip at `/specpad-skill.zip`, and the CloudFront apex flipped from the editor to the landing page.

**Architecture:** A second Vite build (`site/` → `dist-site/`) of plain HTML/CSS — no framework JS. The reference page's field tables and governance list are generated at build time by a `tsx` script that imports the live contract (`src/shared/schema.ts` + `governance.ts`); JSON-Schema `description` annotations are added to every field and enforced by a contract test, so the reference cannot drift. Diagrams are hand-crafted inline SVG in the dark dev-tool theme; screenshots are captured by a committed Playwright script against the live demo mode (shipped in Plan 1, live at `specpad.com/v01/?demo`). `deploy.sh --ship` gains site+zip upload; the full run gains an always-update step for the CloudFront function.

**Tech Stack:** Vite 5 (second config), TypeScript via `tsx` for the generator, Vitest, hand-written HTML/CSS/SVG, Playwright (global install) for screenshots, bash + AWS CLI.

**Spec:** `docs/superpowers/specs/2026-06-09-landing-page-design.md` §1–5, §7–12 (Plan 1 — demo mode, §6 — is merged and live).

**Branch:** create `feat/marketing-site` (via superpowers:using-git-worktrees) before Task 1. One PR.

**Visual direction (locked during brainstorming — do not re-decide):** dark dev-tool. Tokens: bg `#0d1117`, surface `#161b22`, border `#30363d`, text `#e6edf3`, muted `#8b949e`, accent green `#3fb950` (links/highlights) and `#238636` (primary buttons), blue `#1f6feb` (sparingly). Monospace accents (terminal/diff motifs); logo treatment `specpad_` with a green blinking-cursor underscore. Copy is generic about regulation — **never name a specific standard** (no IEC/ISO/DO/FDA). Every feature description emphasizes simplicity for the developer. Creative latitude: implementers OWN the visual polish (spacing, type scale, hover states, diagram aesthetics) within these tokens — use the `frontend-design:frontend-design` skill for the landing-page tasks.

**Context for the implementer:**
- `npm test`, `npx tsc --noEmit`, `npm run lint` must be green before any "done" claim.
- The editor build (`npm run build` → `dist/` → `/v01/`) must remain untouched.
- Demo mode is live: dev-server URL `http://localhost:5173/?demo` (Vite middleware serves `docs/specpad/` at `/demo/`), production `https://specpad.com/v01/?demo`.
- Global Playwright is available via `NODE_PATH=$(npm root -g)`; chromium launches headless in this environment.

---

### Task 1: Schema field descriptions + contract test

**Files:**
- Modify: `src/shared/schema.ts`
- Test: `src/shared/__tests__/schema-descriptions.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `src/shared/__tests__/schema-descriptions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { projectSchema, srsSchema, vtpSchema, releasesSchema, jobSchema } from '../schema';

// The reference page is generated from these schemas; a field without a
// description renders an empty cell and means the contract is under-documented.
// Recursively assert every property (including nested object/array-item
// properties) carries a non-empty description.
type AnySchema = Record<string, any>;

function missingDescriptions(schema: AnySchema, path: string): string[] {
  const missing: string[] = [];
  const props = schema.properties as Record<string, AnySchema> | undefined;
  if (!props) return missing;
  for (const [key, prop] of Object.entries(props)) {
    const here = `${path}.${key}`;
    if (typeof prop.description !== 'string' || prop.description.trim() === '') {
      missing.push(here);
    }
    if (prop.properties) missing.push(...missingDescriptions(prop, here));
    if (prop.items?.properties) missing.push(...missingDescriptions(prop.items, `${here}[]`));
  }
  return missing;
}

describe('schema field descriptions', () => {
  it.each([
    ['project', projectSchema],
    ['srs', srsSchema],
    ['vtp', vtpSchema],
    ['releases', releasesSchema],
    ['job', jobSchema],
  ])('%s schema describes every field', (_name, schema) => {
    expect(missingDescriptions(schema as AnySchema, _name)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/__tests__/schema-descriptions.test.ts`
Expected: FAIL — long lists of missing descriptions.

- [ ] **Step 3: Add descriptions to every field**

In `src/shared/schema.ts`, add a `description` to every property of all five JSON Schemas (top-level AND nested `documents.items` / `items.items` / `releases.items` / `author` properties). Use these texts verbatim (they ship on the public reference page):

| Schema | Field | Description |
|---|---|---|
| all | `schemaVersion` | Contract version of this file; "1.0" documents open in the pinned editor build at /v01/. |
| all | `type` | Document discriminator; selects the schema this file is validated against. |
| project | `name` | Short system name; also the filename stem ([name].proj.json). |
| project | `title` | Human-readable project title shown in the editor. |
| project | `description` | Optional free-text summary of the system under specification. |
| project | `documents` | The SRS and VTP files that make up this project. |
| project | `documents[].type` | Which kind of document this entry points at: "srs" or "vtp". |
| project | `documents[].path` | Path of the document file, relative to the project index. |
| project | `documents[].title` | Display title for the document. |
| srs | `name` | Short system name; also the filename stem ([name].srs.json). |
| srs | `title` | Human-readable document title. |
| srs | `items` | Ordered list of requirements and section headings. |
| srs/vtp | `items[].id` | Stable machine identifier, generated once and never changed; all cross-references target it. |
| srs/vtp | `items[].code` | Human-facing label (e.g. "DOC-1"); freely renameable because references never use it. |
| srs | `items[].text` | The requirement statement. |
| vtp | `items[].text` | The test procedure: what to do to verify the linked requirements. |
| srs/vtp | `items[].heading` | True when this item is a section heading rather than a requirement/test. |
| srs/vtp | `items[].level` | Indent depth for hierarchy; absent means 0. Headings form dotted section codes. |
| srs/vtp | `items[].tags` | Free-form labels for filtering and grouping. |
| srs | `items[].hazards` | Reserved hazard labels (legacy v1 field; the editor no longer surfaces it). |
| vtp | `items[].verifies` | Ids of the SRS requirements this test verifies — ids, never codes, so renames cannot break traceability. |
| vtp | `items[].expected` | The expected result that defines a pass. |
| vtp | `items[].result` | Latest recorded outcome: "", "not_tested", "passed", or "failed". Roll-ups are computed on read, never stored. |
| vtp | `items[].notes` | Evidence and context for the recorded result (e.g. which automated test covers it). |
| releases | `name` | Project name this manifest belongs to. |
| releases | `tagPattern` | Git tag glob (e.g. "v*") that marks releases of the spec. |
| releases | `baseline` | Version whose snapshot the editor diffs the working copy against (the current redline base). |
| releases | `releases` | One entry per matching git tag, oldest first. |
| releases | `releases[].version` | The release tag name. |
| releases | `releases[].ref` | Commit hash the tag points at. |
| releases | `releases[].date` | Commit date (ISO). |
| releases | `releases[].author` | Author of the tagged commit (release-granularity attribution). |
| releases | `releases[].snapshot` | Path of the cached snapshot under docs/specpad/, or null if not yet cached. |
| author | `name` | Author display name from git. |
| author | `email` | Author email from git. |
| job | `job` | The active work item (a ticket key or issue number) that current changes are attributed to. |
| job | `title` | Optional human-readable summary of the job. |

(`authorRefSchema`'s two fields get the `author` rows. Keep the existing structure untouched — descriptions are additive and Ajv ignores them.)

- [ ] **Step 4: Run tests to verify everything passes**

Run: `npx vitest run` and `npx tsc --noEmit`
Expected: all green — descriptions are additive, so the whole existing suite (validation, dogfood, parity) must be unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/shared/schema.ts src/shared/__tests__/schema-descriptions.test.ts
git commit -m "feat(contract): describe every schema field (feeds the generated reference)"
```

---

### Task 2: Site scaffold — second Vite build

**Files:**
- Create: `site/vite.config.ts`, `site/index.html` (minimal shell for now), `site/src/styles.css`
- Modify: `package.json` (scripts + `tsx` devDependency), `.gitignore`

- [ ] **Step 1: Install tsx**

Run: `npm install --save-dev tsx`

- [ ] **Step 2: Create `site/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import path from 'node:path';

// Marketing site build: plain HTML/CSS, no framework JS.
// Output goes to dist-site/ and deploys to the S3 bucket ROOT (the editor
// builds separately to dist/ -> /v01/). reference/index.html is generated by
// site/src/generate-reference.ts before this build runs (see build:site).
export default defineConfig({
  root: __dirname,
  base: '/',
  build: {
    outDir: path.resolve(__dirname, '../dist-site'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        reference: path.resolve(__dirname, 'reference/index.html'),
      },
    },
  },
});
```

- [ ] **Step 3: Create the minimal shell**

`site/src/styles.css` — the design tokens and base styles (extend freely in later tasks):

```css
:root {
  --bg: #0d1117;
  --surface: #161b22;
  --border: #30363d;
  --text: #e6edf3;
  --muted: #8b949e;
  --accent: #3fb950;
  --accent-strong: #238636;
  --blue: #1f6feb;
  --mono: ui-monospace, 'SFMono-Regular', 'JetBrains Mono', Menlo, Consolas, monospace;
  --sans: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  line-height: 1.6;
}
```

`site/index.html` — placeholder that proves the pipeline (replaced in Task 4):

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SpecPad — requirements that live in your repo</title>
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <h1>specpad_</h1>
  </body>
</html>
```

Create `site/reference/index.html` as a one-line placeholder (`<!DOCTYPE html><html><body>generated in Task 3</body></html>`) so the build has its second input until the generator exists.

- [ ] **Step 4: Wire npm scripts and gitignore**

In `package.json` scripts add:

```json
    "dev:site": "vite --config site/vite.config.ts",
    "build:site": "tsx site/src/generate-reference.ts && vite build --config site/vite.config.ts",
```

(Until Task 3 creates the generator, test the build with `npx vite build --config site/vite.config.ts` directly.)

In `.gitignore` add (under "Build output"):

```
dist-site/
site/reference/
```

NOTE: `site/reference/index.html` is generated output and must be git-ignored, but Step 3 creates a placeholder — after adding the ignore rule, the placeholder simply stays untracked. The `build:site` script regenerates it.

- [ ] **Step 5: Verify the build**

Run: `npx vite build --config site/vite.config.ts && ls dist-site/ dist-site/reference/`
Expected: `dist-site/index.html`, `dist-site/reference/index.html`, hashed CSS under `dist-site/assets/`.

Run: `npm test` — all green (nothing in the suite touches site/).

- [ ] **Step 6: Commit**

```bash
git add site/ package.json package-lock.json .gitignore
git commit -m "feat(site): second Vite build target for the marketing site"
```

---

### Task 3: Reference generator (TDD)

**Files:**
- Create: `site/src/generate-reference.ts`, `site/src/reference-template.html`
- Test: `site/src/__tests__/generate-reference.test.ts` (new; add `site/**/*.test.ts` to the vitest `include` in the ROOT `vite.config.ts`)

- [ ] **Step 1: Write the failing test**

Create `site/src/__tests__/generate-reference.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run site/src/__tests__/generate-reference.test.ts`
Expected: FAIL — module not found. (If vitest doesn't pick the file up, first extend `test.include` in the root `vite.config.ts` to `['src/**/*.test.{ts,tsx}', 'skill/**/*.test.ts', 'site/**/*.test.ts']`.)

- [ ] **Step 3: Implement the generator**

`site/src/generate-reference.ts` — exports `renderReference(opts?)` (pure, testable) and, when run as a script, writes `site/reference/index.html`:

```typescript
/**
 * Generates the schema reference page from the LIVE contract module.
 * Field tables come from the JSON Schemas (description annotations required —
 * missing one fails the build); governance rules come from GOVERNANCE_RULES.
 * Run via: tsx site/src/generate-reference.ts  (first step of build:site)
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {
  projectSchema, srsSchema, vtpSchema, releasesSchema, jobSchema,
} from '../../src/shared/schema';
import { GOVERNANCE_RULES } from '../../src/shared/governance';

type AnySchema = Record<string, any>;

const DEFAULT_SCHEMAS: Record<string, AnySchema> = {
  project: projectSchema as AnySchema,
  srs: srsSchema as AnySchema,
  vtp: vtpSchema as AnySchema,
  releases: releasesSchema as AnySchema,
  job: jobSchema as AnySchema,
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function typeLabel(prop: AnySchema): string {
  if (prop.const !== undefined) return `const ${JSON.stringify(prop.const)}`;
  if (prop.enum) return prop.enum.map((v: unknown) => JSON.stringify(v)).join(' | ');
  if (prop.type === 'array') {
    return prop.items?.properties ? 'array of objects' : `array of ${prop.items?.type ?? 'any'}`;
  }
  if (Array.isArray(prop.type)) return prop.type.join(' | ');
  return prop.type ?? 'any';
}

interface Row { field: string; type: string; required: boolean; description: string }

function collectRows(schema: AnySchema, prefix: string, out: Row[]): void {
  const required = new Set<string>(schema.required ?? []);
  for (const [key, prop] of Object.entries((schema.properties ?? {}) as Record<string, AnySchema>)) {
    const field = prefix ? `${prefix}.${key}` : key;
    if (typeof prop.description !== 'string' || !prop.description.trim()) {
      throw new Error(`Schema field "${field}" has no description — the reference page would be incomplete.`);
    }
    out.push({ field, type: typeLabel(prop), required: required.has(key), description: prop.description });
    if (prop.properties) collectRows(prop, field, out);
    if (prop.items?.properties) collectRows(prop.items, `${field}[]`, out);
  }
}

function fieldTable(name: string, schema: AnySchema): string {
  const rows: Row[] = [];
  collectRows(schema, '', rows);
  const body = rows.map((r) => `
      <tr>
        <td><code>${esc(r.field)}</code></td>
        <td><code>${esc(r.type)}</code></td>
        <td>${r.required ? 'required' : 'optional'}</td>
        <td>${esc(r.description)}</td>
      </tr>`).join('');
  return `
    <section id="schema-${name}">
      <h3><code>${name}</code></h3>
      <table>
        <thead><tr><th>Field</th><th>Type</th><th></th><th>Description</th></tr></thead>
        <tbody>${body}
        </tbody>
      </table>
    </section>`;
}

function governanceList(): string {
  return GOVERNANCE_RULES.map((r) => `
    <section class="rule" id="rule-${r.id}">
      <h3><code>${r.id}</code> — ${esc(r.title)}</h3>
      <p>${esc(r.description)}</p>
    </section>`).join('');
}

export function renderReference(opts?: { schemas?: Record<string, AnySchema> }): string {
  const schemas = opts?.schemas ?? DEFAULT_SCHEMAS;
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const template = fs.readFileSync(path.join(dir, 'reference-template.html'), 'utf8');
  const tables = Object.entries(schemas).map(([n, s]) => fieldTable(n, s)).join('\n');
  return template
    .replace('<!-- @FIELD_TABLES -->', tables)
    .replace('<!-- @GOVERNANCE_RULES -->', governanceList());
}

// Script entry: write the page for the site build.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const outDir = path.join(dir, '..', 'reference');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), renderReference());
  console.log('generated site/reference/index.html');
}
```

- [ ] **Step 4: Author `site/src/reference-template.html`**

A full HTML document in the site theme (`<link rel="stylesheet" href="/src/styles.css">`, same header/footer as the landing page once Task 4 exists — for now a simple header linking back to `/`). Contains, in order, with a left-hand table of contents (links to the section ids):

1. **Overview** (hand-written): the file set (`[name].proj.json`, `[name].srs.json`, `[name].vtp.json`, sidecars `[name].releases.json` + `[name].job.json`, snapshot cache `.specpad/`) and how they relate; files live in `docs/specpad/` in the user's repo; `schemaVersion` → pinned editor build (`"1.0"` → `/v01/`) so old documents always open in an editor that understands them; git owns history (no modified-by/date fields); nothing derived is stored (counts and roll-ups are computed on read).
2. **Field reference**: `<!-- @FIELD_TABLES -->` marker (generated).
3. **Governance rules** (intro sentence: JSON Schema validates structure; these policy rules run in both the skill and the editor from one shared module): `<!-- @GOVERNANCE_RULES -->` marker (generated).
4. **Annotated example** (hand-written): a short real SRS item + VTP item pair (lift a real pair from `docs/specpad/`, e.g. an EDS requirement and its TEST), shown as a highlighted JSON block with callouts explaining `id` vs `code` and the `verifies` link.
5. **Install & use the skill** (hand-written): download link `/specpad-skill.zip`; install = unzip into `~/.claude/skills/` (so `~/.claude/skills/specpad/SKILL.md` exists); then in any repo say "set up specpad" to scaffold `docs/specpad/`; other trigger phrases: "write a spec", "formalize requirements", "add a requirement", "write tests for", "check traceability"; the skill validates structure + governance before finishing, and humans review the same files in the hosted editor (link `/v01/`).

- [ ] **Step 5: Run tests, build, verify**

Run: `npx vitest run site/src/__tests__/generate-reference.test.ts` — PASS.
Run: `npm run build:site && grep -c "schema-" dist-site/reference/index.html` — generated page present in the build.
Run: `npm test && npx tsc --noEmit` — all green.

- [ ] **Step 6: Commit**

```bash
git add site/ vite.config.ts
git commit -m "feat(site): schema reference generated from the live contract"
```

---

### Task 4: Landing page — shell, hero, how-it-works (overview diagrams)

Use the `frontend-design:frontend-design` skill for this task and Task 5.

**Files:**
- Modify: `site/index.html` (replace placeholder), `site/src/styles.css`
- Create: `site/src/diagrams/` SVG files as needed (inline them into the HTML; keeping authoring copies in the folder is optional)

- [ ] **Step 1: Build the page shell and hero**

Structure (from the approved wireframe; copy is final unless visually awkward, in which case adjust minimally):

1. **Header** (sticky): `specpad_` logo (monospace, green blinking-cursor underscore via CSS animation); anchor nav How it works · Features · Get started · <a href="/reference/">Schema reference</a>; right-aligned button **Open the editor →** linking `/v01/`.
2. **Hero**: monospace eyebrow line `$ git log docs/specpad/srs.json`; H1 **"Requirements that live in your repo."**; paragraph: *"Regulatory-grade requirements management for engineers: a traceable SRS and verification tests stored as schema-validated JSON in git — kept in sync with your code by a Claude skill, reviewed and approved by humans in a visual editor."*; primary CTA **Download the Claude skill** (`/specpad-skill.zip`), secondary **See it live** (`/v01/?demo`); a decorative diff motif (`- "status": "draft"` red / `+ "status": "approved"` green, monospace).
3. **Footer**: `specpad_` · Schema reference (`/reference/`) · Open the editor (`/v01/`) · Live demo (`/v01/?demo`) · `schema v1.0 · editor /v01/`.

- [ ] **Step 2: How-it-works section — two overview diagrams**

Section heading: **"One contract. Two ways to edit. Git in the middle."** Two side-by-side inline SVGs (stack on mobile), each with `<title>` and `aria-label`:

- **Diagram A — the sync loop** (nodes connected in a cycle, git-graph styling, green/blue accents on the dark surface): `your code changes` → `Claude skill updates srs/vtp JSON` → `docs/specpad/*.json in git` → `human reviews & approves in the editor` → `git commit / PR` → back to start.
- **Diagram B — one contract, two editors**: center node `shared schema + governance (src/shared)`; left arm `Claude skill — edits programmatically`; right arm `visual editor — humans review & approve`; both arms read/write a `docs/specpad/*.json` file node beneath the center; caption under git: `git is the history & merge layer`.

Below the diagrams, the demo CTA banner: **"See it live — browse SpecPad's own spec in the editor"** → `/v01/?demo` (mention it's SpecPad documenting itself, read-only).

- [ ] **Step 3: Verify visually**

Run `npm run dev:site`, screenshot the page at 1400px and 420px wide with Playwright (global install, headless) and LOOK at the screenshots: no overlap/cutoff, hierarchy clear, diagrams legible at both sizes.

- [ ] **Step 4: Run gates and commit**

`npm test && npx tsc --noEmit && npm run build:site` — green.

```bash
git add site/
git commit -m "feat(site): landing shell, hero, how-it-works overview diagrams"
```

---

### Task 5: Landing page — seven feature rows + who-it's-for + get-started

**Files:**
- Modify: `site/index.html`, `site/src/styles.css`

- [ ] **Step 1: Feature rows**

Each row: H3 name → one-to-two-sentence description → side-by-side panels **"What it looks like"** (a `<figure>` with `<img src="/assets/shots/<name>.png">` — images land in Task 6; give every img real alt text and width/height to avoid layout shift; panel links to `/v01/?demo` where noted) and **"How it works"** (inline SVG diagram). Alternate panel order row-to-row. Rows stack on mobile. Copy and diagram content:

1. **Effortless requirements editing** — "A spreadsheet-fast table for your SRS and VTP. The editor opens files straight from your repo — no server, no import, nothing leaves your machine." Shot: `srs-table.png` (links to demo). Diagram: `docs/specpad/*.json` file node ⇄ `browser editor` node, annotated `File System Access — no backend`.
2. **Docs that keep up with your code** — "The Claude skill reads and writes the same files. Finish a change, say “update the spec” — requirements and tests stay current without leaving the terminal." Shot: none — instead a styled terminal mockup (HTML/CSS, monospace): a short transcript `> update the spec for the new export flow` / `✓ updated specpad.srs.json (2 requirements)` / `✓ updated specpad.vtp.json (2 tests)` / `✓ validation + governance clean`. Diagram: skill node and editor node both pointing at the same file node, labeled `one shared contract`.
3. **Traceability by construction** — "Every test declares what it verifies, linked by stable ids that survive renames. Governance checks flag untested requirements before an auditor does." Shot: `testing-view.png`. Diagram: three columns `requirement (id r_…)` → `test (verifies: r_…)` → `result (passed)`, arrows labeled `by id, never by name`.
4. **Redlines, automatically** — "The editor diffs your working copy against the released baseline — see exactly what changed since the last release, with no hand-maintained change tables." Shot: `redlines.png` (links to demo). Diagram: `baseline snapshot (v1.0 tag)` and `working copy` feeding a `diff` node → `redline view`; caption `git owns the history`.
5. **Version history from your tags** — "Releases are just git tags. SpecPad snapshots each one, so any past revision is one click away — author and date come from the commit itself." Shot: `version-history.png`. Diagram: timeline of tags `v0.1 — v1.0 — working`, each tag with a snapshot box, arrow to `history dialog`.
6. **Tied to your ticket** — "Associate working changes with a job — a ticket key, an issue number — so every requirement edit traces back to why it happened." Shot: `job-chip.png`. Diagram: `job marker ([name].job.json)` node linking `current edits` → `ticket JIRA-123`-style node.
7. **Validated twice: structure and policy** — "JSON Schema catches malformed files; governance rules catch broken links, missing expected results, and untraceable requirements. The skill and the editor run the same checks from one shared module." Shot: `status-bar.png`. Diagram: a document flowing through two stacked gates `structure (JSON Schema)` then `policy (governance)`, with a side note `schemaVersion "1.0" → pinned editor /v01/`.

- [ ] **Step 2: Who it's for + get started**

- **Who it's for** — two columns: *Regulated industries* ("Audit-ready traceability, structured evidence, and human approval gates — without standing up heavyweight tooling.") / *Everyone else* ("The same rigor is just good engineering practice: specs that can't silently rot, tests that can't silently detach.").
- **Get started** — three numbered steps (monospace): 1. Download the skill (`/specpad-skill.zip`) → 2. Unzip into `~/.claude/skills/` → 3. Say `set up specpad` in your repo. Repeat the download CTA; caption `specpad-skill.zip · schema v1.0`. Link "full instructions" → `/reference/#install`.

- [ ] **Step 3: Verify visually** (dev server + Playwright screenshots at 1400px/420px, broken-image icons are EXPECTED for the 6 shot files until Task 6) and run gates: `npm test && npx tsc --noEmit && npm run build:site`.

- [ ] **Step 4: Commit**

```bash
git add site/
git commit -m "feat(site): feature rows, audience, and get-started sections"
```

---

### Task 6: Editor screenshots (captured from the live demo)

**Files:**
- Create: `site/scripts/capture-screenshots.mjs`, `site/assets/shots/*.png` (6 files, committed)
- Modify: root `vite.config.ts` is NOT touched; the script runs against the dev server

- [ ] **Step 1: Write the capture script**

`site/scripts/capture-screenshots.mjs` (run with `NODE_PATH=$(npm root -g) node site/scripts/capture-screenshots.mjs` while `npm run dev` is serving on :5173):

```javascript
/**
 * Captures the marketing screenshots from the editor running in demo mode.
 * Prereq: `npm run dev` on :5173 (demo middleware serves docs/specpad at /demo).
 * Usage:  NODE_PATH=$(npm root -g) node site/scripts/capture-screenshots.mjs
 * Re-run after any editor UI change so the marketing shots never go stale.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.EDITOR_URL ?? 'http://localhost:5173';
const OUT = new URL('../assets/shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
await page.goto(`${BASE}/?demo`);
await page.waitForSelector('.status-demo');
await page.waitForTimeout(1500); // let the entrance animation settle

const shot = (name, clip) => page.screenshot({ path: `${OUT}${name}.png`, ...(clip ? { clip } : {}) });

// 1. SRS table (top of the requirements view)
await shot('srs-table', { x: 0, y: 60, width: 1400, height: 620 });

// 2. Testing view with the coverage roll-up
await page.click('text=Results');
await page.waitForTimeout(500);
await shot('testing-view', { x: 0, y: 60, width: 1400, height: 620 });

// 3. Redlines on the VTP view
await page.click('text=Verification Tests');
await page.waitForTimeout(500);
await shot('redlines', { x: 0, y: 60, width: 1400, height: 620 });

// 4. Version history dialog
await page.click('button:has-text("v1.0")');
await page.waitForTimeout(500);
await shot('version-history');
await page.keyboard.press('Escape');

// 5. Job chip (menubar right side)
await shot('job-chip', { x: 980, y: 0, width: 420, height: 56 });

// 6. Status bar with validation summary
await shot('status-bar', { x: 0, y: 856, width: 1400, height: 44 });

await browser.close();
console.log('6 screenshots written to site/assets/shots/');
```

- [ ] **Step 2: Capture**

Start `npm run dev` (background), run the script, stop the server. LOOK at all six PNGs (Read tool) — each must show what its feature row claims (e.g. `redlines.png` visibly contains changed-cell highlighting; `version-history.png` shows the dialog with v0.1/v1.0). Adjust clip regions if a capture is off and re-run.

- [ ] **Step 3: Wire into the page and verify**

The `<img>` paths from Task 5 now resolve. Run `npm run build:site`, confirm the PNGs are in `dist-site/assets/shots/` (Vite copies anything under `site/assets/`? NO — Vite only copies referenced/public assets. Put the folder at `site/public/assets/shots/` instead: Vite copies `site/public/` verbatim into the build root. Adjust the script OUT path and the img srcs accordingly — `/assets/shots/...` URLs stay the same). Re-screenshot the landing page and LOOK: real screenshots in place, no broken images.

- [ ] **Step 4: Commit**

```bash
git add site/scripts/capture-screenshots.mjs site/public/assets/shots/
git commit -m "feat(site): editor screenshots captured from demo mode"
```

---

### Task 7: Polish + link integrity test

**Files:**
- Modify: `site/index.html`, `site/src/styles.css`
- Create: `site/src/__tests__/site-links.test.ts`, `site/public/favicon.svg`, `site/public/og-image.png`

- [ ] **Step 1: Meta + assets**

- `<meta name="description" content="Git-based, regulatory-grade requirements management: traceable SRS and verification tests as schema-validated JSON — synced by a Claude skill, reviewed in a visual editor.">`
- OpenGraph/Twitter tags (`og:title`, `og:description`, `og:image` → `/og-image.png`, `og:url` → `https://specpad.com/`). Generate `og-image.png` (1200×630) by screenshotting a hero-like HTML card with Playwright.
- `favicon.svg` — simple: dark rounded square, monospace green `s_`.
- Responsive pass at 420px: rows stack, nav collapses to essentials, hero CTAs full-width.
- Accessibility pass: every SVG has `<title>`/`aria-label`, color contrast of muted text on bg ≥ 4.5:1 for body copy (bump `--muted` if needed), focus styles on links/buttons.

- [ ] **Step 2: Link integrity test**

`site/src/__tests__/site-links.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Every internal href/src on the landing page must point at something that
// exists in the site source (public/ asset or generated page) or at a known
// runtime URL served by other parts of the deployment.
const RUNTIME_URLS = ['/v01/', '/v01/?demo', '/specpad-skill.zip'];

describe('landing page link integrity', () => {
  const siteDir = path.resolve(__dirname, '../..');
  const html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:href|src)="(\/[^"#]*)/g)].map((m) => m[1]);

  it('references only existing targets', () => {
    const missing = refs.filter((ref) => {
      if (RUNTIME_URLS.includes(ref)) return false;
      if (ref === '/reference/') return false; // generated by build:site — always OK
      if (ref.startsWith('/src/')) return !fs.existsSync(path.join(siteDir, ref.slice(1)));
      return !fs.existsSync(path.join(siteDir, 'public', ref.slice(1)));
    });
    expect(missing).toEqual([]);
  });

  it('has the three core CTAs', () => {
    expect(refs).toContain('/specpad-skill.zip');
    expect(refs.some((r) => r.startsWith('/v01/?demo'))).toBe(true);
    expect(refs).toContain('/reference/');
  });
});
```

- [ ] **Step 3: Gates + visual check + commit**

`npm test && npx tsc --noEmit && npm run lint && npm run build:site` — green. Screenshot 1400px/420px one more time and LOOK.

```bash
git add site/
git commit -m "feat(site): meta, og, favicon, responsive + link-integrity test"
```

---

### Task 8: Deploy — skill zip, site upload, CloudFront apex flip

**Files:**
- Modify: `infra/deploy.sh`, `infra/cloudfront-function.js`, `infra/README.md`

- [ ] **Step 1: CloudFront function — apex serves the landing page**

In `infra/cloudfront-function.js`, change the apex rule and the header comment:

```javascript
//   /            -> /index.html        (apex lands on the marketing site)
…
  if (uri === '' || uri === '/') {
    request.uri = '/index.html';
    return request;
  }
```

Everything else (directory-index and extension passthrough rules) stays. Note `/reference/` is handled by the existing trailing-slash rule → `/reference/index.html`.

- [ ] **Step 2: deploy.sh — update the function on every full run**

The full provisioning run currently only CREATES the function ("function exists" branch never pushes new code). Replace the else-branch of step 6 with an idempotent update+publish:

```bash
else
  ETAG=$(aws cloudfront describe-function --name "$FUNCTION_NAME" --query 'ETag' --output text)
  aws cloudfront update-function --name "$FUNCTION_NAME" --if-match "$ETAG" \
    --function-config Comment="SpecPad URL rewrite",Runtime="cloudfront-js-2.0" \
    --function-code "fileb://$SCRIPT_DIR/cloudfront-function.js" >/dev/null
  ETAG=$(aws cloudfront describe-function --name "$FUNCTION_NAME" --query 'ETag' --output text)
  aws cloudfront publish-function --name "$FUNCTION_NAME" --if-match "$ETAG" >/dev/null
  echo "function code updated + published"
fi
```

- [ ] **Step 3: deploy.sh — ship the site and zip**

Extend the `--ship` block from 4 to 5 steps. After the demo upload (current 3/4), insert:

```bash
  log "Ship 4/5: build + upload site to s3://$BUCKET/ (root)"
  ( cd "$ROOT_DIR" && npm run build:site )
  ( cd "$ROOT_DIR/skill" && rm -f "$ROOT_DIR/dist-site/specpad-skill.zip" \
    && zip -qr "$ROOT_DIR/dist-site/specpad-skill.zip" specpad )
  aws s3 sync "$ROOT_DIR/dist-site/" "s3://$BUCKET/" --delete \
    --exclude "v0*/*" --exclude "demo/*"
```

and renumber the invalidation to `Ship 5/5`, replacing its paths with the everything-path:

```bash
  INVALIDATION_ID=$(aws cloudfront create-invalidation --distribution-id "$DIST_ID" \
    --paths "/*" --query 'Invalidation.Id' --output text)
  log "DONE — shipped https://$DOMAIN/ (site), /$PREFIX/ (editor), /$PREFIX/?demo (demo)  (invalidation $INVALIDATION_ID)"
```

CRITICAL: the `--exclude "v0*/*" --exclude "demo/*"` flags scope `--delete` so the root sync can never delete the versioned editor builds or the demo content (exclude filters apply to deletion candidates too). The zip is rebuilt fresh into `dist-site/` each ship so it can never go stale.

- [ ] **Step 4: Sanity checks (no AWS)**

```bash
bash -n infra/deploy.sh
npm run build:site && ( cd skill && zip -qr ../dist-site/specpad-skill.zip specpad ) && unzip -l dist-site/specpad-skill.zip
```
Expected: zip lists `specpad/SKILL.md` + `specpad/templates/*` (5 files). Also `ls dist-site/` shows `index.html`, `reference/`, `assets/`, `specpad-skill.zip`, plus favicon/og-image.

- [ ] **Step 5: README**

Update `infra/README.md`: apex `/` now serves the marketing site (`/index.html`); editor remains at `/v01/`; site + zip upload happen in `--ship`; the CloudFront function is updated+published by the full run (which must be run once for the apex flip to take effect — note that explicitly in the redeploy steps).

- [ ] **Step 6: Commit**

```bash
git add infra/
git commit -m "infra: ship marketing site + skill zip; apex serves landing page"
```

---

### Task 9: Dogfood + final verification + PR

- [ ] **Step 1: Record the feature in SpecPad's own spec**

Per the dogfooding rule, add to `docs/specpad/specpad.srs.json` + `specpad.vtp.json` (follow `skill/specpad/SKILL.md` conventions exactly as in Plan 1 Task 6 — fresh ids, next codes, `verifies` by id):
- Requirement: "The schema reference page shall be generated at build time from the shared schema and governance modules, and the build shall fail if any schema field lacks a description." + test verifying it (cite `site/src/__tests__/generate-reference.test.ts` + `schema-descriptions.test.ts`).
- Requirement: "The distributable skill shall be downloadable from the site as a zip archive rebuilt from the repository at every deploy." + test (cite the ship step; manual verification of the live URL).

Run `npm test` — dogfood + parity green. Commit: `dogfood(specpad): record reference-generation and skill-distribution requirements`.

- [ ] **Step 2: Full gates**

`npm test && npx tsc --noEmit && npm run lint && npm run build && npm run build:site` — all green.

- [ ] **Step 3: Real-app check**

`npx vite preview --config site/vite.config.ts` (serves dist-site) — drive with Playwright and LOOK at screenshots: landing renders at both widths, reference page complete (field tables for all 5 types, 3 governance rules, install section), all internal links resolve (the `/v01/` ones 404 locally — expected, they're runtime URLs).

- [ ] **Step 4: PR**

Use superpowers:finishing-a-development-branch. PR title: `feat(site): marketing landing page, generated schema reference, skill download`. Body notes: apex flip happens only when the full `infra/deploy.sh` run publishes the updated CloudFront function (a `--ship` alone uploads content but leaves the apex on the editor); bookmarked bare `specpad.com` now lands on the marketing page.

- [ ] **Step 5: After merge — deploy and verify live (outward-facing: confirm with Geoff)**

1. `infra/deploy.sh --ship` (site + zip + invalidation), then the full `infra/deploy.sh --no-wait` once (function update + publish for the apex flip).
2. Verify: `https://specpad.com/` serves the landing page; `/reference/` complete; `/specpad-skill.zip` downloads and unzips to a working skill; `/v01/` editor unchanged; `/v01/?demo` demo unchanged.

---

## Self-review notes

- **Spec coverage:** §2 approach ✓ (T2/T3), §3 visual direction ✓ (locked block + T4/T5), §4 layout/build ✓ (T2; `reference/` generated, gitignored), §5 landing structure ✓ (T4 sections 1–3 + 7, T5 sections 4–6), §7 reference page ✓ (T1 descriptions, T3 generator/template incl. all four content blocks), §8 deployment ✓ (T8; delete-scoping via excludes; apex flip + function-update gap closed), §9 diagrams/screenshots ✓ (T4/T5 specs + T6 script), §10 testing ✓ (T1 contract test, T3 generator tests, T7 link test; demo tests shipped in Plan 1), §11 polish ✓ (T7), §12 out-of-scope respected.
- **Deviation from spec (deliberate):** screenshots live in `site/public/assets/shots/` (Vite copies `public/` verbatim) rather than `site/assets/` — noted inline in T6. Feature row 2 uses a styled terminal mockup instead of a screenshot (a real Claude Code session screenshot isn't reproducibly capturable); flagged in T5.
- **Type consistency:** `renderReference(opts?)` signature matches between T3 test and implementation; token names in T2 CSS are the ones referenced in T4/T5; shot filenames in T5 match the T6 script.
- **Creative-work granularity:** deterministic infrastructure (generator, tests, deploy, capture script) is fully coded; visual HTML/SVG work is specified by structure, final copy, node/edge content, and acceptance criteria ("LOOK at screenshots") with the frontend-design skill directed — full pixel-level code in a plan would be fiction.
