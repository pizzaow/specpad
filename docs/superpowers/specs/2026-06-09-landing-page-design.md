# SpecPad landing page + schema reference + live demo — design

**Date:** 2026-06-09
**Status:** approved in brainstorming; ready for implementation planning

## 1. Goal

Give `specpad.com` a public face: a landing page that explains SpecPad as a **git-based,
regulatory-grade requirements management solution**, a generated **schema reference** page, a
downloadable **Claude skill**, and a **live read-only demo** of SpecPad's own dogfood spec in the
editor. Audience: engineers who need regulatory-grade documentation; pitched generically
("regulated industries", "audit-ready") — **no specific standards named** (no IEC/ISO/DO/FDA
name-drops). Secondary audience: any team that wants spec rigor as best practice. Copy emphasizes
**simplicity for the developer** throughout.

## 2. Approach (chosen: Approach 1)

A second build target in this repo, same Vite/TypeScript toolchain. Landing + reference are
**plain HTML/CSS** (no framework JS on the marketing pages); the reference page's field tables and
governance list are **generated at build time** from the live contract module (`src/shared/`), so
the reference cannot drift from the schema — a schema change the generator can't render fails the
build.

Rejected: fully hand-authored static pages (reference would drift — undercuts the product's core
pitch); a static-site generator like Astro/Eleventy (new dependency and idiom for two pages;
revisit if docs expand).

## 3. Visual direction

**Dark dev-tool** (chosen from three mockups): GitHub-dark palette (`#0d1117` background,
`#3fb950`/`#238636` green accents, `#8b949e` muted text), monospace/terminal motifs, diff
snippets (`- "status": "draft"` / `+ "status": "approved"`), git-graph-styled diagrams. Logo
treatment: `specpad_` with blinking-cursor accent. Speaks fluent developer; leans on the
"managed like code" angle.

## 4. Repo layout & build

```
site/
  index.html              # landing page (hand-authored)
  reference/              # generated output (git-ignored)
  src/
    styles.css            # shared dark theme
    diagrams/*.svg        # hand-crafted inline-able SVGs
    generate-reference.ts # imports src/shared/{schema,governance} → emits reference page
    reference-template.html # hand-authored shell the generated tables slot into
  assets/                 # editor screenshots, og-image, favicon
```

- `npm run build:site` — runs the reference generator (via `tsx`), then Vite builds `site/` →
  `dist-site/`.
- `npm run build` (editor → `dist/`, deployed under `/v01/`) is untouched.

## 5. Landing page structure (`specpad.com/`)

1. **Header** — `specpad_` logo; anchor nav (How it works · Features · Get started · Schema
   reference); persistent **Open the editor →** button.
2. **Hero** — headline "Requirements that live in your repo."; one-paragraph pitch:
   traceable SRS + verification tests as schema-validated JSON, synced by a Claude skill, reviewed
   and approved in a visual editor. Primary CTA **Download the Claude skill**; secondary **Open
   the editor**. Animated diff motif.
3. **How it works (overview)** — two diagrams side by side:
   - **Sync loop**: code change → Claude skill updates SRS/VTP JSON → human reviews/approves in
     editor → git commit.
   - **One contract, two editors**: shared schema/governance module at center; the skill edits
     programmatically, humans edit visually; git is the history/merge layer.
   Followed by the demo CTA: **"See it live — browse SpecPad's own spec"** → demo.
4. **Features** — seven full-width rows. Each row: feature name → 1–2 sentence description
   (developer-simplicity emphasis) → side-by-side panels **"What it looks like"** (screenshot,
   linking into the demo where sensible) and **"How it works"** (diagram).
   1. **Effortless requirements editing** — spreadsheet-fast SRS/VTP tables; files open straight
      from the repo; no server, nothing leaves your machine. Diagram: repo JSON ⇄ browser editor
      (File System Access, no backend).
   2. **Docs that keep up with your code** — the Claude skill reads/writes the same files; "update
      the spec" from the terminal. Diagram: skill + editor obeying the one shared contract.
   3. **Traceability by construction** — tests declare `verifies` links by stable `id` that
      survive renames; governance flags untested requirements. Diagram: requirement → test →
      result graph. Screenshot: testing view / coverage roll-up.
   4. **Redlines, automatically** — editor diffs working copy against the released baseline; no
      manual change tables. Diagram: baseline snapshot vs working copy. Screenshot: redline view.
   5. **Version history from your tags** — releases are git tags; SpecPad snapshots each; any past
      revision one click away with author/date from the commit. Diagram: tags → releases →
      snapshots timeline. Screenshot: version chip + history dialog.
   6. **Tied to your ticket** — job sidecar associates working changes with a Jira key / issue
      number. Diagram: job sidecar linking changes → ticket. Screenshot: job control.
   7. **Validated twice: structure and policy** — JSON Schema catches malformed files; governance
      catches broken links, missing expected results, untraceable requirements; same checks in
      skill and editor. Diagram: two-layer check + `schemaVersion "1.0"` → pinned editor `/v01/`.
5. **Who it's for** — two columns: regulated industries (audit-ready traceability, structured
   evidence, human approval gates) / everyone else (rigor as good engineering practice).
6. **Get started** — three steps: download the skill (.zip) → install into Claude Code →
   say "set up specpad" in your repo. Download CTA + filename/version caption.
7. **Footer** — schema reference, editor, demo links; schema/editor version note.

## 6. Live demo (editor feature + content prep)

**Editor demo mode.** The editor gains a fetch-based read-only mode: when its URL carries the
demo query parameter (`/v01/?demo`), it loads the project over HTTP from a hosted directory
(`specpad.com/demo/…`) instead of prompting for a local folder. Saving is disabled with a visible
**"Demo — read-only"** indicator (status bar); all viewing features — tables, testing view,
validation, version history, redlines, job chip — work normally. Fetch failure shows a friendly
in-editor message, not a blank screen.

**Demo content** = SpecPad's own dogfood spec, `docs/specpad/*.json`, copied to `s3://…/demo/` by
`deploy.sh --ship`. The demo is always the real, current spec of the product (dogfooding as
marketing). **Everything in the demo is public** — spec content, history snapshots, job title —
acknowledged and accepted.

**Preparation work:**
1. Cache per-release snapshot files under `docs/specpad/` and commit them, so version history
   diffs work in the demo; keep doing so at each release.
2. Add `specpad.job.json` pointing at the current work item and keep genuine working changes vs
   the baseline, so the demo's redline view shows real active changes.
3. Per the dogfooding rule, the demo-mode feature itself is added to SpecPad's SRS/VTP via the
   specpad skill during implementation.

## 7. Schema reference page (`specpad.com/reference/`)

Same dark theme/header as the landing page; side table of contents (long page).

**Generated** (by `generate-reference.ts`, build-time, from `src/shared/`):
- **Field tables** — one per document type (`proj`, `srs`, `vtp`, sidecars `releases`, `job`):
  field, type, required/optional, description. Requires adding standard JSON-Schema `description`
  annotations to every field in `schema.ts` (descriptions live in the contract; future use for
  editor tooltips). Generator **fails the build** if any field lacks a description.
- **Governance rules** — rendered from `GOVERNANCE_RULES` (id, title, description). New rules
  appear automatically at next deploy.

**Hand-authored** (template the generated parts slot into):
1. **Overview** — the file set and relationships; files live in `docs/specpad/`;
   `schemaVersion` → pinned editor build (`"1.0"` → `/v01/`) model.
2. **Annotated example** — trimmed real SRS + VTP snippets with callouts: stable `id` vs
   human-facing `code`; `verifies` links; no modified-by/date fields (git owns history); nothing
   derived is stored.
3. **Skill install & usage** — download link; install steps; trigger phrases ("set up specpad",
   "add a requirement", "check traceability", …) and what the skill does for each.

## 8. Deployment changes

`deploy.sh --ship` extended:
1. Editor build → `s3://bucket/v01/` (unchanged).
2. Site build → bucket **root** (`index.html`, `reference/`, `assets/`); `--delete` scope
   explicitly excludes `/v01/` and `/demo/`.
3. `docs/specpad/*.json` (incl. snapshots) → `/demo/`.
4. Fresh `zip` of `skill/specpad/` → `/specpad-skill.zip` (cannot ship stale).
5. CloudFront function: apex `/` now serves `/index.html` instead of `/v01/index.html`; all other
   rules unchanged. **Behavioral change:** bare `specpad.com` bookmarks now land on the marketing
   page, one click from the editor (persistent header button).

## 9. Diagrams & screenshots

- Diagrams: **hand-crafted inline SVG** in the dark theme (crisp, no runtime deps, full styling
  control; Mermaid rejected as generic-looking). Each gets `<title>` + alt text.
- Screenshots: captured by a repeatable **Playwright script** against the editor in demo mode
  loading the real dogfood spec; committed to `site/assets/`; re-run after UI changes.

## 10. Testing

- **Reference generator test** (Vitest): generator runs against the live contract; every schema
  field has a description; every `GOVERNANCE_RULES` id appears in output; output parses.
- **Demo-mode tests**: demo param triggers fetch-based load; save paths blocked; read-only
  indicator renders.
- **Existing suites stay green** — dogfood test validates the new `specpad.job.json` and committed
  snapshots like everything else; parity test unaffected.

## 11. Polish

Feature rows stack on mobile; fast first paint (static pages, no framework JS); standard meta
(title, description, og-image, favicon).

## 12. Out of scope

- Naming specific regulatory standards in copy.
- React/SPA architecture for marketing pages.
- A full documentation site (reference page is structured to grow; SSG migration possible later).
- Demo write-back of any kind (strictly read-only).
