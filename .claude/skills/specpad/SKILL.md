---
name: specpad
description: Use when formalizing or maintaining software requirements and their verification tests as governed JSON (an SRS, a VTP, and a project index) in the repo's docs/specpad/ folder — the structured, editor-backed replacement for markdown specs. Triggers on "write a spec", "formalize requirements", "create requirements", "add a requirement", "write tests for", "set up specpad", "check traceability".
---

# SpecPad

Create and maintain SpecPad documents: a project index, an SRS (requirements), and a
VTP (verification tests), stored as JSON under `docs/specpad/` and edited either by you
or by humans in the hosted editor. One shared contract governs both.

## Position in workflow

brainstorming (design decisions) → **specpad** (structured requirements and verification
tests as SRS/VTP JSON) → writing-plans (implementation plan).

Use after a design is settled and before implementation planning — when a feature needs
trackable, testable requirements — and whenever you update requirements for an existing
feature. The brainstorming skill writes a prose design doc and then hands off to
writing-plans; insert SpecPad in between when you want the requirements captured as
governed, test-traceable documents rather than prose.

## The SpecPad working loop (capture requirements as you build)

In a SpecPad-governed repo (`docs/specpad/` present), requirements and tests are a **first-class
output of development, captured as you work** — never written up afterward. The user's intent, expressed
in the working conversation, *is* the requirement before it is formalized; your job is to distill it
into the SRS/VTP **spec-first**, attributed to a job, alongside the code. For each unit of work:

1. **Job first.** Ensure an active open job exists (`<name>.jobs.json` + `<name>.job.json`); create one
   if needed. It groups this unit's commits and pushes.
2. **Evaluate impact across every registered document type — before you implement.** A job can touch any
   of the project's document types, not just requirements. Go through each one the project tracks (its
   project index plus the architecture, i.e. the document-type registry) and decide whether this job
   changes it; update the affected ones *spec-first*, in the same job:
   - **Requirements (SRS)** — the durable behavioral rule(s), at the "shall" altitude (see below).
   - **Verification (VTP)** — a verifying test per requirement (next step).
   - **Product requirements (PRD)** — when the job changes user-facing intent / a user need.
   - **Architecture (SAD)** — when the job adds or changes a component, module, interface, or contract
     (e.g. a new view, a new shared module, a new pillar): update `<name>.sad.md` and its diagrams. Most
     within-a-component tweaks don't; structural changes do. Don't let the SAD drift.
   - **Any other registered pillar** (SOUP, cybersecurity, SDD, …) — same question, same rule.

   Capture **intent, not transcript**. Most jobs touch SRS+VTP; surface which document types you judged
   this job affects so the user can correct.
3. **Author the test chain.** requirement → VTP entry → the actual automated test where automatable
   (e.g. vitest), named in the VTP `notes` → code. No requirement should ship without a test.
4. **Implement against the spec**, keeping ids/refs stable and governance clean.
5. **Autonomous but visible.** Write the requirements/tests (and any architecture/PRD updates) without
   waiting for line-by-line approval, then tell the user what you captured (the codes + one line each,
   and which document types you touched) so they can **edit after** and correct granularity. Wrong
   granularity — or a missed document type — is the main risk; surfacing it is the cheap fix.

**What rises to a requirement (distillation — the hard part):** a testable statement about
externally-observable behavior or a governing constraint — "what the system *shall* do." NOT incidental
implementation detail ("uses a Map"), how a function is structured, or exploratory back-and-forth that
didn't land. One requirement per distinct behavioral rule, at the "shall" altitude, not the
code-structure altitude. The litmus test: *could I write a test that fails if this behavior regressed?*
If yes, it's a requirement.

This loop is the **primary** mechanism. The pre-push gate and requirement audit (below) are the
**backstop** that catches whatever the loop missed or any manual edit — not a substitute for it.

**Authoring guides (read just-in-time — keep this prompt lean).** Before writing or revising each kind of
entry, read the matching guide for what to capture, how to phrase, and good/bad examples. Do **not** inline
them here; read the one you need when you reach that step:

- Requirements → `guides/requirements.md`
- Verification tests → `guides/tests.md`
- Product requirements (PRD) → `guides/product-requirements.md`
- Architecture (SAD) → `guides/architecture.md`

## Files and naming

- `docs/specpad/<name>.proj.json` — project index
- `docs/specpad/<name>.srs.json` — requirements
- `docs/specpad/<name>.vtp.json` — verification tests
- `docs/specpad/<name>.prd.json` — optional product requirements (user needs / product intent) that
  SRS requirements trace up to via `satisfies` (see Product requirements below)
- `docs/specpad/<name>.sad.md` — optional architecture document (arc42 skeleton, markdown)
- `docs/specpad/<name>.<diagram>.svg` — optional diagrams (draw.io SVG exports) the SAD references inline
- `docs/specpad/<name>.workspace.dsl` — optional C4 model (Structurizr DSL — an alternative to draw.io)
- `docs/specpad/index.html` — generated launcher (opens the hosted editor)

Every JSON file carries `"schemaVersion": "1.0"`.

## Architecture spec (arc42 + C4) — optional

When a project documents its architecture, keep it as **tracked text files** (not the id-keyed JSON
contract): `<name>.sad.md` (arc42 skeleton) with **diagrams placed inline by the markdown** as draw.io
SVG exports (`![caption](<name>.context.svg)` etc.), plus an editable soft **authoring guide**
`<name>.sad.guide.md`. A Structurizr C4 model (`<name>.workspace.dsl`) is an **optional** alternative to
draw.io for teams that want model-as-code C4. This keeps the requirements contract simple; architecture
is a separate, optional spec.

**Profiles:** the **generic** profile ships in core (`templates/sad.generic.md` + `sad.guide.generic.md`)
— a clean, fuller arc42, **no safety classification**, the default for any project. For **medical /
regulated** projects (IEC 62304 / FDA), install the separate **`specpad-medical`** add-on skill, which
brings the medical profile (per-unit classification, segregation, architecture verification) and its
regulatory governance. Core stays lean; the regulated layer is opt-in.

The **authoring guide** is soft context (tone, terminology, what to emphasize) — the skill **reads it
before editing the SAD**; the editor shows it as a panel. Guidance steers; governance enforces — keep
hard rules out of the guide.

- **Coupling is job/release-level, not requirement-level.** Do NOT maintain a requirement↔architecture
  trace matrix (not required by 62304; architecture only needs to be derived-from and verified-to-
  implement the requirements, which the arc42 prose states). A job's architecture impact comes from
  diffing its snapshots, the same as SRS/VTP.
- **Third-party components (SOUP/OTS) are NOT inventoried in the SAD** — they belong in a separate,
  SBOM-aligned components register (a planned pillar). The SAD references it; it does not contain it.
- **Cybersecurity architecture** is a planned companion pillar (much of it derivable) — not built yet.
- **Diagrams — the markdown defines where they go.** Author in **draw.io**, export **SVG**, and
  reference each from the SAD with `![caption](<name>.context.svg)`; the editor renders each inline at
  that spot (client-side). Put the **Context overview near the top**, plus Building Block (interfaces),
  Runtime (process), and Deployment diagrams where they belong. Per-job diagram change tracking is
  **coarse** — "the diagram file changed", never in-diagram deltas (no regulatory submission tracks that).
- The Architecture view has **Edit** (syntax-highlighting markdown editor; the optional DSL too) and
  **Display** (rendered arc42 with inline diagrams + the guide) sub-tabs; the web view is a pseudo-render
  (formal Word output comes from the skill export, not the browser).
- Author/update the SAD in the **working loop** alongside requirements when a change affects the
  architecture; it rides with the job and the code.
- **On close / refresh**, snapshot `<name>.sad.md` and `<name>.workspace.dsl` into the release baseline
  and the per-job cache (`.specpad/jobs/<id>/{before,after}/`) alongside the spec docs, so a job's
  architecture changes can be shown going forward.

## Initialize SpecPad (`specpad init`)

When a user installs the skill and asks to "set up specpad" / "specpad init" / "initialize specpad",
run this one-time, **idempotent** setup so the project is fully wired — capture loop, enforcement, and
launcher — with no manual configuration. Re-running it must be a safe no-op.

1. **Scaffold** `docs/specpad/` if absent (see "Scaffolding a new project"): project index, **PRD**, SRS,
   VTP, and the empty releases manifest, with `PROJECT_NAME` replaced — the **full default set**; list
   each document in the project index `documents[]`. **Never overwrite** existing documents. (The PRD is
   optional — a project may delete it; but it is scaffolded by default so user-need traceability is
   on from the start.)
2. **Ask the project path (short quiz):** "Is this a **medical** device project (IEC 62304 / FDA), or a
   **generic** project?" For **generic** (the default), scaffold `sad.generic.md` → `<name>.sad.md` and
   `sad.guide.generic.md` → `<name>.sad.guide.md` (replace `PROJECT_NAME`). For **medical**, use the
   **`specpad-medical`** add-on skill (its templates) — if it isn't installed, tell the user to add it.
   The SAD references diagrams (draw.io SVGs) the user adds; the Structurizr `workspace.dsl` is opt-in
   only. The user can switch later by re-scaffolding. (More profile options can be added.)
3. **Generate the launcher** `docs/specpad/index.html` from the template.
4. **Install the pre-push hook** (the commit-check backstop):
   ```
   mkdir -p .githooks
   cp <skill>/templates/hooks/pre-push .githooks/pre-push
   chmod +x .githooks/pre-push
   git config core.hooksPath .githooks
   ```
   If `core.hooksPath` is already set to a different directory, **do not clobber it** — copy the hook
   into that directory instead and tell the user.
5. **Wire `CLAUDE.md`** (this is what turns the pull-triggered skill into the always-on working loop):
   if the file has no `<!-- specpad:working-loop -->` sentinel, **append** `templates/CLAUDE.specpad.md`
   to it (create `CLAUDE.md` only if absent). **Never overwrite** an existing `CLAUDE.md`.
6. **Validate** every file written and **report** what was set up versus already present.

After `init`, the working loop is active every session and the pre-push gate enforces a job per commit.

## Baseline generator (draft a spec from existing code)

When adopting SpecPad on an **existing codebase** (no SpecPad docs yet), draft the **full default
design-control set** from the code so there is a baseline to maintain. The output is a
**draft for human ratification, never authoritative** — deriving requirements from code *proposes*
intent; the user confirms it.

**By default the generator drafts the project's configured document types** — today **PRD + SRS + VTP + a
starter SAD** — so adoption produces the full set, not just requirements and tests. It is **registry-aware**:
a pillar added later (SOUP, cybersecurity, SDD) is drafted the same way once configured. Any type can be
**declined** for a given project (say so when you surface the draft).

1. **Job first.** Open an adoption job (e.g. "Baseline draft").
2. **Survey** the codebase: entry points, public API / CLI / UI surfaces, modules and their
   responsibilities, the README/docs, and the **existing tests** (the richest source of intended
   behavior).
3. **Distill behavioral requirements** (SRS), grouped into sections (headings) by feature area, at the
   "shall" altitude — one per distinct externally-observable behavior or constraint, **not**
   implementation detail. Tag every generated item `draft`. (Read `guides/requirements.md`.)
4. **Map to tests** (VTP). For each requirement write a VTP entry. If an existing automated test covers
   it, name it in `notes` and set `result` to reflect it (`passed` if it passes); for a behavior with
   **no** test, write the VTP procedure with `result: "not_tested"` — record the gap, never omit it.
5. **Draft a PRD (default).** From the surveyed purpose — the README/docs, product intent, any tracker
   context — propose **product requirements** at the user-need altitude (`status: "proposed"`,
   ratifiable), and link the SRS requirements up to them via `satisfies`. Derive the *why* from intent,
   **not** code (code can't tell you it); mark everything proposed — it needs more human confirmation
   than the SRS. (Read `guides/product-requirements.md`.)
6. **Draft a starter architecture (default).** Scaffold an arc42 `<name>.sad.md` with a **context
   overview** and a **building-block** diagram (draw.io SVG) reflecting the modules and interfaces
   surveyed in step 2 — load-bearing decisions and contracts, not every class. (Read
   `guides/architecture.md`; use the architecture profile from `init`.)
7. **Keep it governance-clean**: every requirement has a verifying VTP entry, every test an `expected`,
   and (when a PRD exists) every implemented PRD item is satisfied by a requirement.
8. **Report coverage** explicitly — what you covered and what you could not (areas too unclear to spec),
   and which document types you drafted vs deferred — rather than silently truncating.
9. **Surface for ratification.** Say it is a draft, summarize the sections and the `draft` / `not_tested`
   counts (and the proposed PRD items and the SAD), and invite edits. This is the cold-start form of the
   requirement audit; the commit-time audit then keeps it in sync as the code evolves.

## Requirement audit (reconcile the spec with the code)

Periodically — or on request ("audit requirements", "check for drift") — reconcile the existing SRS/VTP
against the **whole codebase**. This is the whole-repo form of the commit-time audit (which does the
same over a single staged diff); both **propose, never auto-apply**.

1. **Job first.** Open an audit job.
2. **Read** the current SRS/VTP and survey the code (as for the baseline generator).
3. **Compare both directions and categorize findings:**
   - **Missing** — code behavior with no requirement → propose a `draft` requirement (and a verifying
     test) derived from the code, for the user to ratify.
   - **Stale** — a requirement whose described behavior is gone or changed → flag for update or
     removal; **never silently delete** a requirement.
   - **Coverage** — a requirement with no covering test, or a VTP `notes` reference to a test that no
     longer resolves → flag the gap.
4. **Report, don't mutate:** present the findings as categorized proposals; apply nothing destructive
   automatically. Ratified new requirements land as `draft` for review.
5. **Report coverage/confidence** — which areas you audited and how confident — rather than silently
   truncating.

## Scaffolding a new project

1. Create `docs/specpad/` if missing.
2. Copy the templates from this skill's `templates/` folder, replacing every `PROJECT_NAME` token
   with the system's short name: `starter.proj.json`, `starter.srs.json`, `starter.vtp.json`, and
   `starter.releases.json` (the empty change-tracking manifest). `.specpad/` is created later, on the
   first `refresh`.
3. Validate (see "Validate before finishing").

## The v1 shape

Shared envelope on every file: `schemaVersion` ("1.0"), `type`
("project" | "srs" | "vtp" | "prd"), `name`, `title`.

SRS item — REQUIRED `id`, `text`. Optional `code`, `satisfies`, `tags`, `hazards`, `heading`.
VTP item — REQUIRED `id`, `text`. Optional `code`, `verifies`, `expected`, `result`,
`notes`, `tags`, `heading`. `result` is one of "" | "not_tested" | "passed" | "failed".
PRD item — REQUIRED `id`, `text`. Optional `code`, `tags`, `heading`. (PRD is the optional
product-requirements register; same item shape as the SRS.)

## Product requirements (PRD) — optional upward trace

A project may add an optional **PRD register** (`<name>.prd.json`, `type: "prd"`) holding
*product* requirements — user needs / product intent that sit above the software requirements.
It uses the same item shape as the SRS (stable `id`, renameable `code`, `text`), so it reuses the
diff, table, and governance machinery.

- An SRS requirement traces upward by setting **`satisfies`** to the PRD item **ids** it satisfies
  (ids, never `code` labels — renames never break the trace). This mirrors how a VTP test's
  `verifies` targets SRS ids.
- A PRD entry is *product intent*, not a code fact — derive a draft from the job description (and any
  ingested tracker/PRD context), then surface it for ratification; do not auto-finalize from code.
- Each item carries an optional **`status`** — `implemented` (realized; must trace down to ≥1 SRS
  requirement) or `proposed` (approved intent not yet allocated; roadmap/vision). New items default to
  `proposed`; promote to `implemented` once requirements exist. This lets a **product-vision baseline**
  hold the full roadmap without manufacturing false coverage gaps.
- **Opt-in governance:** when a PRD register is present, `prd-referential-integrity` and
  `prd-coverage` apply (see Governance). A project with no PRD register pays nothing.

## Hierarchy (sections and sub-requirements)

Items are a flat, ordered array, but each SRS/VTP item may carry an optional **`level`** (an integer
indent depth; absent means 0). Use `level` to nest: a sub-heading or a child requirement sits one
level deeper than its parent.

- **Headings form sections.** A heading's `code` is a short segment (e.g. `Data`, `Range`). Its
  displayed code is the dotted path of ancestor heading segments plus its own — a heading `Range` at
  level 1 under a heading `Data` at level 0 displays as `Data.Range`. Requirements keep their own
  free-form `code` (e.g. `DOC-1`).
- **When to use it:** when a spec naturally has sections and sub-requirements, author it
  hierarchically — headings for sections with short `code` segments, and `level` to nest
  requirements and sub-headings — rather than a single flat list. Keep nesting shallow and
  meaningful; do not over-nest.
- `level` is additive and optional; files without it are still valid (everything is flat at level 0).

## Stable ids (critical)

- Every item has a stable `id`, generated once and **immutable**.
- Format: a typed prefix + 6 random hex digits — `r_` for requirements, `t_` for tests,
  `h_` for headings (e.g. `r_7f3a9c`, `t_a12b`).
- Generate by picking 6 random hex digits; if the id already exists in that file, pick
  again. Never reuse a human label as an id.
- **All references use `id`.** A VTP test's `verifies` array holds SRS item `id`s, never
  their `code` labels. Renaming a `code` must never change an `id` or break a reference.

## Never store derived data or history

- Do NOT add `numTests`, result roll-ups, `modifiedUser`, `modifiedDate`, or change
  counters. Git owns history; roll-ups are computed on read.

## Change tracking (git plumbing only — never diff)

Change tracking is **derived from git and rendered by the editor**. Your only job is to keep a small,
committed, regenerable cache up to date. **You never compute diffs or attribution** — the editor computes
all redlines, version diffs, and attribution from the raw snapshots you write using the shared
`diffDocs`. This is what guarantees the skill and editor can never disagree.

### Cache files (under `docs/specpad/`, all committed — never gitignore them)
- `<name>.releases.json` — the **manifest**: the release register the editor reads for its version
  timeline and baseline. Type `releases`. User-editable.
- `<name>.job.json` — optional **current-job marker** (`{ "type": "job", "job": "PROJ-123",
  "title": "..." }`). Set by the user (often in the editor); you fold it into commit trailers.
- `<name>.jobs.json` — optional **jobs register** (no-tracker case). Type `jobs`. Records live under a
  top-level `jobs: [ … ]` array (**not** `items` — that field name is used by the register documents
  srs/vtp/prd, but `jobs.json`'s array is named `jobs`). Each record is
  `{ id, code?, title, description?, technical_notes?, status: "open"|"closed" }` and holds **no change
  associations** (which items/commits a job touched is derived from git via the `Job:` trailer).
  `description` is release-note-voice (what a user reads in the changelog); `technical_notes` is the
  engineer-voice detail (root cause, mechanism, files touched) — see the *Jobs register* section.
  `job.json`'s `job` points at the active record's **`id`**. A closed record's scope is sealed: don't
  re-activate it — create a new record for further work.
- `.specpad/baseline/` — raw snapshot of the spec files at the latest release (always present once
  refreshed).
- `.specpad/snapshots/<version>/` — raw snapshots of older releases, pulled on demand and then kept.
- `.specpad/jobs/<id>/{before,after}/` — raw spec snapshots for a job. `before/` is written **when the
  job is created** (its starting point) so the editor can show the active open job's in-progress changes
  (before vs the working copy); `after/` is added **on close**, freezing the job's final change-set.
  Regenerable by `refresh`.

`.specpad/` is a normal committed directory (deliberately not named `.cache/`, which many global
gitignores exclude). It holds **only verbatim copies** of past spec files — never diffs.

### `refresh` — keep the manifest and baseline current (idempotent)
Run at release time or on request:
1. Determine the tag pattern: use `tagPattern` from `<name>.releases.json` if present, else default
   `v*`. List matching tags newest-last: `git tag --list '<pattern>' --sort=creatordate`.
2. For every matching tag not already in `releases.json`, append an entry
   `{ version, ref, date, author, snapshot }`:
   - `version`: the tag name as-is (e.g. `"v1.0"`).
   - `ref`: the resolved commit SHA — `git rev-parse <tag>^{commit}` (dereferences annotated tags to their target commit).
   - `date`: `git log -1 --format=%cs <tag>` (commit date, `YYYY-MM-DD`).
   - `author`: the author of the tagged commit — `git log -1 --format='%an	%ae' <tag>` →
     `{ "name": ..., "email": ... }`. (This is **release-granularity** "who", not per-item.)
   - `snapshot`: `null` for now (filled in only when cached).
3. Regenerate `.specpad/baseline/` from the newest matching tag — a **full snapshot of all key
   documents**: **every document listed in the project index** (`<name>.proj.json` `documents[]` — today
   proj/srs/vtp/prd, and any pillar added later: SOUP, cybersecurity, SDD, …) **plus the architecture
   files** (the SAD markdown, its diagrams, the guide). For each, `git show <tag>:docs/specpad/<file>`
   written under `docs/specpad/.specpad/baseline/` mirroring the top-level file names. Iterate the index
   rather than a fixed list, so a newly-registered document type is captured automatically. Set that
   release's `snapshot` to `".specpad/baseline"` and the top-level `baseline` to that version. Also copy
   the latest **verification run** (`.specpad/run/<name>.run.json`) into the baseline and
   `snapshots/<version>/` — see *Verification runs*.
4. Re-validate every JSON file you wrote.

A **release is a first-class checkpoint**: a version + **its set of jobs** (the closed jobs whose derived
`version` equals that release) + the full-doc snapshot above. The editor's **Releases view** reads this
as release notes (each release with its jobs, newest first); it is also the checkpoint the eQMS export is
generated from. The release→jobs mapping is **derived** (from `job.version`), never stored separately.

If there are **no matching tags**, write a manifest with `baseline: null` and `releases: []` (copy
`templates/starter.releases.json`); the editor degrades gracefully.

### Cutting a release — the cut job closes itself
A release is cut **under a job** (e.g. "Cut release v1.4"). That job is the release's final act, so it
must **close itself as the last step before the release** — never leave it open. In order:
1. Confirm every other in-scope job for this release is `closed`; any still-open job rolls to the next
   release (its commits won't be in this tag).
2. As the **final commit** of the release, set the **release-cut job** to `status: "closed"` in
   `<name>.jobs.json`, write its `after` cache + `commits.json`, and clear it from `<name>.job.json`.
3. Tag the release (`git tag vX`) on that commit, then `refresh` so the manifest, baseline, and every
   job's derived `version` update.

A release-cut job left **open** after its release ships is a process error: the job that cuts the
release is part of the release it cuts (its derived `version` is that release, because the tag contains
its commit). It has no further scope once the tag exists — close it, don't defer it.

### Verification runs — test results as evidence (VTP → test → run)
A verification result is **evidence of an executed test**, not a typed-in claim. The chain is
**VTP item → the automated test that runs it → a captured run**, and SpecPad stores the first and last
links (the test source lives in git; its detail is the report's job):
- **Linkage (stored on the VTP item).** Each automated test carries `automation: [{ runner, file,
  selector? }]` — framework-agnostic: `runner` and `selector` are opaque (e.g. `vitest` + a test name,
  `playwright` + `#15`). A test with no `automation` is **manual** and keeps a hand-recorded `result`.
- **Capture (a run record).** Run the suite with a machine reporter and normalize it to a **`run`
  sidecar** — `{ runner, ref (commit), ranAt, summary, results:[{file, selector?, status}] }` — written
  to `.specpad/run/<name>.run.json`. SpecPad ships a **vitest adapter** (`scripts/specpad-verify.mjs`);
  other runners are sibling adapters, or your CI emits the same normalized JSON directly. The core never
  parses a test framework.
- **Derivation.** The editor derives each automated test's result by matching its `automation` links to
  the run's `results` (by file, then selector) — passed/failed/skipped, or **not run** when a link has
  no matching result. Manual tests fall back to their stored `result`. Nothing derived is stored.
- **Freeze for key deliverables.** Copy the latest run record into the **release baseline** at `refresh`
  (and `snapshots/<version>/`) and into a job's **`after/`** at close, alongside the spec snapshots — so
  each release and each closed job carries its own verification evidence. Regenerable by re-running.

### `pull <version>` — cache an older snapshot on demand
`git show <ref>:docs/specpad/<file>` for each spec file into `.specpad/snapshots/<version>/`
(mirroring top-level names), then set that release entry's `snapshot` to that path. Do **not** diff.

### Jobs register (`<name>.jobs.json`) — when there is no external tracker
The register's top-level shape is `{ schemaVersion, type: "jobs", name, jobs: [ … ] }` — records live
under **`jobs`**, not `items`. Each record is `{ id, code?, title, description?, technical_notes?,
status }` only, and carries **no change associations** (which items and commits a job touched is derived
from git, never stored). Maintain it as authoritative metadata (it is **not** part of the regenerable
`.specpad/` cache):
- **Create** it the first time the user tracks work without a tracker by copying
  `templates/starter.jobs.json` (replacing `PROJECT_NAME`) — or let them create it in the editor's
  Jobs tab. Generate each record's `id` like any other key — a `j_` prefix + 6 hex digits, unique within
  the file, immutable. **`code` follows the convention `JOB-<n>` monotonic within the project**
  (`JOB-1`, `JOB-2`, …) — it is a human label, freely renameable (nothing references it), so pick the
  next unused `n` when adding a record and don't reuse a code from a deleted one. Set `owner` from git
  (`user.name`/`user.email`) at creation; set `type` to `feature` or `bugfix`.
- **`description` vs `technical_notes` — two altitudes.** `description` is release-note voice: one or
  two sentences a user would read in a changelog ("what shipped, why they care"). `technical_notes` is
  engineer voice: root cause, mechanism, files touched, follow-ups — the detail a maintainer wants when
  they open the job later. Both fields are optional prose; there is no governance rule and either may
  be blank. When a newly-opened job carries engineer detail, put it in `technical_notes` and keep the
  `description` short. Example — the same job at both altitudes:
  > `description`: *"Auth client now retries transient 5xx responses (up to 3× with exponential
  > backoff) so a flaky upstream no longer surfaces as a login failure."*
  > `technical_notes`: *"Introduced `RetryPolicy` in `src/auth/retry.ts` (200/400/800 ms, capped at
  > 3 attempts). Applied it in `AuthClient.login` and `AuthClient.refresh` — the two call sites that
  > were logged as the source of the reported 502s. Non-5xx errors still fail fast (no retry on 4xx).
  > Follow-up: extend to the token-exchange endpoint once its idempotency story is settled."*

  When touching an existing job record whose `description` mixes altitudes, consider splitting it into
  a concise summary + `technical_notes` — no bulk migration is required (existing files without
  `technical_notes` remain valid).
- **Version is derived, not hand-set.** A job's `version` is the release tag whose commits contain the
  job (Unreleased until a release does). Derive it at `refresh`: for each closed job, the earliest tag
  matching the manifest `tagPattern` that contains the job's last commit (`git tag --contains <sha>`).
- **On create**, snapshot the job's **`before`** state into `.specpad/jobs/<id>/before/` — the full key
  doc set: **every document in the project index** (`<name>.proj.json` `documents[]` — proj/srs/vtp/prd
  and any later pillar) plus the architecture files (the SAD markdown, its diagrams, the guide, and an
  `arch-files.json` manifest), the same shape as the close cache — and commit it. Iterate the index, not
  a fixed list. This pins the job's starting point so the editor can show the **active open job's
  in-progress changes** (every register document **and** architecture) — its `before` snapshot diffed
  against the working copy — before the job is ever closed.
- **On close**, add the **`after`** snapshot into `.specpad/jobs/<id>/after/` (raw `git show <last>:…`,
  `<last>` = the job's final commit; for an adopted/older job re-derive `before` from `git show <base>:…`,
  `<base>` = the parent of the job's first commit). Also write `.specpad/jobs/<id>/commits.json` — the
  job's commits from `git log --grep='Job: <id>' --format='%H … %s … %an … %cs'` — so the editor can show
  the commits behind a job's changes. Also copy the latest **verification run**
  (`.specpad/run/<name>.run.json`) into the job's `after/`, so a closed job carries the test evidence for
  its change (see *Verification runs*). The editor diffs/renders these; you never diff. `refresh` rebuilds
  the caches and re-derives versions.

### Source-traceability export (job → commits → code)
Because every commit carries a `Job:` trailer (enforced by the pre-push hook), source-code traceability
is **free and git-derived** — no maintained matrix. On request, or as part of the eQMS export, produce a
per-job report: `git log --grep='Job: <id>'` for the commits, and `git show`/`git diff` for the actual
code changes. This gives **change-mediated** requirement→code traceability (a job ties its SRS/VTP edits,
SAD/SDD edits, and code commits together). It is generated on demand, never a stored matrix.
- **Activate** one or more jobs by writing their `id`s into `<name>.job.json` (`jobs: ["j_…", …]`;
  the legacy single `job: "…"` is still read). Only **open** jobs may be activated (the
  `active-job-open` / `active-job-known` rules).
- **Lifecycle.** Set `status: "closed"` when a job's scope is done; its change-set is then sealed by
  git history. **Never reopen a closed job for new work** — create a new record (the closed job's
  scope was fixed by the commits that already referenced it).
- With an external tracker instead, skip the register: `<name>.job.json` carries the tracker key
  directly and the trailer is that key.

### Commit workflow (jobs) — every spec change traces to a job
Each commit should carry its spec/test edits **and** an associated job; this is what makes
`job → SRS → VTP → source` traceable. When you commit on the user's behalf:
- **Job association is required (pre-commit gate).** If staged changes touch any `docs/specpad/*.json`
  requirements/tests (`git diff --cached --name-only`), then `<name>.job.json` must name **at least one
  open** job. If it is empty, or any entry is missing from / `closed` in `<name>.jobs.json`, stop and
  ask the user to set/reopen or open a job before committing. This is the
  `active-job-required-for-spec-changes` rule; it needs `HEAD`, so it lives here — not in the data-only
  governance set the editor runs.
- **Spec rides with code (pre-commit gate).** If code files are staged, confirm the related
  `docs/specpad/*.json` are staged too when requirements/tests changed. Warn if they look missing.
- **Trailers — one per active job.** Write a separate `Job: <job>` trailer line for **each** entry in
  the marker (a commit may belong to several jobs). With the owned register each trailer carries the
  record's stable **`id`** (never its renameable `code`), so renames can't orphan past commits — render
  `Job: <id>` (optionally `Job: JOB-1 (<id>)`, parsed on the id). Keep all trailers in the final
  trailer block (no blank line between them, alongside any `Co-Authored-By`) or git won't parse them.
- **Many commits/pushes per job is normal.** A job stays in the active marker across as many commits
  and pushes as the work takes; every one carries its `Job:` trailer. The job's change-set is the union
  of those commits, reconstructed from git on demand — never stored.

### Pre-push gate and requirement audit (two layers)
The commit checks above are enforced by two complementary layers; the gate is a deterministic git
hook, the audit is your (the agent's) intelligence.

- **Layer 1 — deterministic hook (`pre-push`).** Canonical copy ships in this skill's
  `templates/hooks/pre-push`; `specpad init` installs it via `git config core.hooksPath .githooks`. It
  runs on every push (even manual ones), so it catches edits made outside the Claude loop. It
  **hard-blocks** any pushed commit with no `Job:` trailer, and **warns** when a commit changes code but
  touches no SRS/VTP — suppressed per commit with a `Spec: none <reason>` trailer (refactor/comments),
  bypassed entirely with `SPECPAD_SKIP=1 git push`. It skips merge commits and never polices history
  before SpecPad was adopted, so it is safe on any branching model and on existing repos.
- **Layer 2 — requirement audit (you, before committing).** When committing on the user's behalf, audit
  the staged diff against the requirements: for any code change with **no mapped requirement**, propose
  a requirement (and verifying test) **derived from the diff** for the user to ratify or waive — do not
  invent intent silently. This is the same audit as a whole-repo requirement audit, scoped to the
  staged diff; it is what keeps the SRS/VTP a faithful twin of the code and catches manual edits the
  hook only warns about.

### On-demand reports (advisory prose, never cached)
Walk git directly and summarize in prose; these are advisory and nothing depends on them.
- **"What changed for the next release"**: the editor shows this live as redline; confirm precisely
  from git by diffing the latest tag (`git describe --tags --abbrev=0`) → `HEAD`.
- **"Trace job `<id>`" (job → SRS → VTP → source)**: `git log -E --grep='^Job: <id>'` lists every
  commit and push that carried the job (often several; a commit may also carry other jobs). For the
  spec delta, diff the spec files between the job's first commit's parent and its last commit (the
  `diffDocs` shape: added/modified/removed SRS/VTP items); the rest of each commit's diff is the source
  code the job changed.
- **Release notes**: for a release range, group the distinct `Job:` ids in `git log <prev>..<rel>`,
  and for each emit its `title`/`description` from `<name>.jobs.json` plus its spec delta.
- **"Who last changed `r_x`"**: `git log -- docs/specpad/<name>.srs.json` (commit-level, on demand).

## Governance — enforce before finishing

These rules are the contract. They mirror the shared validation module exactly; keep them
in sync. Run them mentally (or with the editor) and fix or report every violation before
declaring a task done:

- `traceability`: Every non-heading SRS requirement is referenced by at least one VTP test.
- `referential-integrity`: Every VTP `verifies` entry resolves to an existing SRS item id.
- `missing-expected`: Every non-heading VTP test has a non-empty `expected` value.
- `active-job-open`: No entry in the active-job marker may point at a `closed` job record.
- `active-job-known`: When a jobs register exists, every active-job marker entry must resolve to a
  record in it (no dangling or mistyped ids). With no register, entries are external tracker keys and
  neither job rule applies. (Requiring an active job *whenever spec/test files change* needs `HEAD`, so
  that lives in the commit-workflow pre-commit check above, not in this data-only rule set.)
- `prd-referential-integrity`: When a PRD register is present, every SRS `satisfies` entry resolves to
  an existing PRD item id.
- `prd-coverage`: When a PRD register is present, every non-heading PRD item marked
  `status: "implemented"` is satisfied by at least one SRS requirement (via `satisfies`). `proposed`
  items (or items with no status) are roadmap/vision and exempt. With no PRD register, neither PRD rule
  applies — PRD is opt-in.

Also confirm structural validity: required fields present, `result` within its enum,
`schemaVersion` is "1.0".

## Validate before finishing

Before ending any task that touched these files:
1. Re-read each changed JSON file and confirm it parses.
2. Confirm required fields and the `result` enum.
3. Run the three governance rules above across the SRS+VTP pair.
4. Report any remaining violations to the user (warnings don't block saving, but do block
   "done").
