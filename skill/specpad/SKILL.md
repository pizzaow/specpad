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
   - **Detailed design (SDD)** — when the job changes how a unit works inside, its interface, or the
     data it owns; and whenever it adds a requirement (a new requirement needs a design section to
     point at). **Changing a section obliges you to re-review every requirement that references it** —
     see *Detailed design* below.
   - **Software risk** — when the job adds or changes a way the software could contribute to harm, or
     changes a unit or requirement a risk names. A control measure is a requirement, so adding a
     control means adding a requirement.
   - **Cybersecurity** — when the job adds an interface, a trust boundary, or a component on the
     perimeter. A new entry point without STRIDE walked across it is how a threat model goes stale
     while looking complete.
   - **SOUP** — when the job adds, removes or **upgrades** a third-party dependency. An upgrade moves
     the support window, so revisit the end-of-life date as well as the version.
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
- Detailed design (SDD) → `guides/detailed-design.md`
- Software risk → `guides/risk.md`
- SOUP / off-the-shelf software → `guides/soup.md`
- Threat model and security architecture → `guides/security.md`
- Reviewing what you just wrote → `guides/review-passes.md`

## Files and naming

- `docs/specpad/<name>.proj.json` — project index
- `docs/specpad/<name>.srs.json` — requirements
- `docs/specpad/<name>.vtp.json` — verification tests
- `docs/specpad/<name>.prd.json` — optional product requirements (user needs / product intent) that
  SRS requirements trace up to via `satisfies` (see Product requirements below)
- `docs/specpad/<name>.sdd.json` — optional detailed design: the software units and design views that
  implement the requirements, which SRS items point down at via `design` (see Detailed design below)
- `docs/specpad/<name>.risk.json` — optional software risk analysis (IEC 62304 clause 7): the
  hazardous situations software can contribute to, their causes and controls (see Software risk below)
- `docs/specpad/<name>.soup.json` — optional SOUP / off-the-shelf software register: the third-party
  software the product depends on, assessed (see SOUP below)
- `docs/specpad/<name>.threat.json` — optional threat model and security risk analysis, one register
  (see Cybersecurity below)
- `docs/specpad/<name>.sec.md` — optional security architecture document: the four views a submission
  is expected to contain
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
   **generic** project?"

   For a **medical** project, ask three more — each records something a submission is asked for and
   nothing else in the repo can supply:

   - **"What software safety class, and why?"** → `safetyClass` and `safetyClassRationale` in the
     project index (§4.3). Take the rationale, not just the letter; a class with no reasoning is the
     half of 4.3 that gets cited. Authoring stays at maximum rigor whatever the answer.
   - **"Did this software exist before you started following 62304?"** → if yes, §4.4 wants a gap
     analysis and a risk-based justification, which is a quality-system document; say so plainly
     rather than leaving the clause unanswered.

   SpecPad does not keep a register of the quality-system documents it relies on — a quality system
   already indexes what it holds, and a second index in a git repository would be the one that goes
   stale. The editor's Planning view names the *kind* of system that holds each process instead.

   For **generic** (the default), skip all three. Then scaffold `sad.generic.md` → `<name>.sad.md` and
   `sad.guide.generic.md` → `<name>.sad.guide.md` (replace `PROJECT_NAME`). For **medical**, use the
   **`specpad-medical`** add-on skill (its templates) — if it isn't installed, tell the user to add it.
   The SAD references diagrams (draw.io SVGs) the user adds; the Structurizr `workspace.dsl` is opt-in
   only. The user can switch later by re-scaffolding. (More profile options can be added.)
3. **Generate the launcher** `docs/specpad/index.html` from the template. Replace `PROJECT_NAME`
   with the project name, and **every** occurrence of `EDITOR_BASE_URL` (there are two — the
   redirect and the no-JavaScript fallback link) with the project index's `editorBaseUrl`, or
   `https://specpad.com` when it sets none. A team running its own SpecPad server sets
   `editorBaseUrl` in `<name>.proj.json` so everyone on the repo lands on their server rather than
   the public editor; regenerate the launcher whenever that value changes.
   Also replace `EDITOR_PROJECT_ID` with the index's **`editorProjectId`**, or the empty string when
   it sets none. One server can host several repositories' projects, and that id is how this
   repository's launcher opens **its own** project rather than the server's project list; a server
   hosting a single project needs no id.
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

**By default the generator drafts the project's configured document types** — PRD + SRS + VTP + SDD + a
starter SAD. It is **registry-aware**: a pillar added later is drafted the same way once configured.
Any type can be **declined** for a given project (say so when you surface the draft).

**Mark everything `draft: true`** — every requirement, test and design section you write. A scaffold
that cannot be told from a specification is the one failure mode this generator has, and a reviewer
clears the flag as they ratify. Never write a draft item without it.

### One pass is not enough

A single sweep produces the *observable API surface* and stops: it finds what each module does and
misses what it refuses, what it decided against, and every corner the code handles without announcing
it. Work in passes, each asking a different question of the same code. **Report after each pass** what
it added, so the user can stop you early or redirect.

1. **Job first.** Open an adoption job (e.g. "Baseline draft").

2. **Pass 1 — survey and structure.** Entry points, public API / CLI / UI surfaces, modules and their
   responsibilities, the README and docs. Produce the **SDD sections** (one per software unit, plus the
   cross-cutting views) and the SRS **headings** that group by feature area. Nothing else yet: getting
   the skeleton wrong is cheap now and expensive later. (Read `guides/detailed-design.md`.)

3. **Pass 2 — the behaviour each surface promises.** For every public surface, the requirements a
   caller could rely on. This is the pass a single-sweep generator does, and on its own it is thin.
   (Read `guides/requirements.md`.)

4. **Pass 3 — what the code refuses.** Re-read the same modules looking only for guard clauses,
   validation, `throw`, early returns, `catch`, clamps, retries, timeouts and defaults. Each is a
   decision somebody made about a case that can occur, and each is a requirement — usually one nobody
   would think to write from the outside. **This pass typically finds as many requirements as pass 2.**

5. **Pass 4 — the tests as a source of intent.** Existing tests encode behaviour the code cannot state:
   which cases were thought worth pinning, what the author expected to go wrong, and the odd specific
   value that is there because it once broke. Mine them for requirements the first three passes missed,
   and for the negative cases pass 6 will need.

6. **Pass 5 — the invariants.** What is true across the whole system rather than in one module:
   identity and reference rules, what is deliberately not stored, ordering and idempotency guarantees,
   compatibility promises. These rarely live in one file and are almost always missed by a per-module
   sweep.

7. **Pass 6 — the verification protocol.** Now write the VTP, **not one test per requirement** — see
   *Verification protocol depth* below. Map each to an existing automated test where one covers it, and
   record a gap as `not_tested` rather than omitting it. (Read `guides/tests.md`.)

8. **Pass 7 — security testing**, where the project has a threat model or any security requirement.
   Add the FDA §V.C types the codebase admits of, tagged so they can be produced on request — see
   *Security testing* in `guides/tests.md`.

9. **Pass 8 — the upward trace.** Draft the **PRD** from surveyed purpose — the README, product intent,
   any tracker context — at the user-need altitude (`status: "proposed"`), and link requirements up via
   `satisfies`. Derive the *why* from intent, **not** code; code cannot tell you it. (Read
   `guides/product-requirements.md`.)

10. **Pass 9 — the starter architecture.** Scaffold an arc42 `<name>.sad.md` with a context overview
    and a building-block diagram reflecting the modules and interfaces from pass 1 — load-bearing
    decisions and contracts, not every class. **Do not skip this**: without it, IEC 62304 §5.3 and the
    FDA architecture expectations are unanswerable. (Read `guides/architecture.md`.)

11. **Ask what the code cannot tell you.** For a medical project, the same questions `init` asks:
    the **safety class and its rationale** (§4.3), and whether the software predates the standard
    (§4.4). A baseline-adopted project that is never asked has no answer to 4.3 at all.

12. **Fill the advisory fields as you write** — `category` on every requirement, `verificationLevel`
    and `kind` on every test, `acceptance` on every unit, `securityControl` on every security
    requirement. Advisory means governance will not fail an established register for omitting them; it
    is not permission for a new draft to.

13. **Keep it governance-clean**, then **report coverage explicitly** — which areas you covered, which
    you could not, which document types you drafted versus declined, and the `draft` / `not_tested`
    counts. Never truncate silently.

14. **Surface for ratification.** Say plainly that it is a scaffold: it holds what the code does, and
    not the decisions, rejected alternatives or corner cases discovered through failure that only the
    working loop captures. Invite edits.

### What a baseline cannot produce

Say this to the user rather than letting them discover it. A generated baseline holds observable
behaviour. It does not hold **why** a design was chosen, what was tried and rejected, the corner case
found by a bug three months ago, or intent. Those arrive through the working loop, captured as the work
happens — which is what the loop is *for*. A baseline is the starting point that makes the loop
possible, not a substitute for having run it.

## Review passes — a fresh look at what was just written

Governance checks that a document is well-formed and linked. It cannot tell you it is **true**: a
citation can be to a superseded edition, a trace can resolve to a plausible wrong target, and a
requirement can describe behaviour the code does not have. Those need a reader.

Read `guides/review-passes.md` before running one. Four roles — **Author** (produce, and cite),
**Auditor** (is the citation true?), **Adversary** (is the approach wrong?), **Examiner** (what does
the code handle that the document does not mention?).

- **Run each as a sub-process with a fresh context**, given the artefact and the sources and **not the
  reasoning behind it**. A reviewer told why you did something will agree that you did it. Where
  sub-processes are unavailable, re-read the sources rather than your notes, and say the review was
  weaker.
- **Every finding names its evidence** — a line, a construct, a test name, a clause. A finding with no
  source cannot be acted on or argued with.
- **The Examiner stops when a round produces no finding that names a source.** "Are there more corner
  cases?" has no natural end; bounding on evidence rather than satisfaction is what stops a review
  manufacturing requirements nobody can verify.
- **Act on findings in the same job.** A finding recorded and left reads later as one somebody already
  considered and accepted.
- **Scale to the moment**: all four at baseline and before a submission; Author + Examiner on an
  ordinary job, where a human is already reviewing and the cost repeats forever.

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
5. **Report coverage/confidence** — which areas you audited and how confident you are — rather
   than silently truncating the answer.

## Scaffolding a new project

1. Create `docs/specpad/` if missing.
2. Copy the templates from this skill's `templates/` folder, replacing every `PROJECT_NAME` token
   with the system's short name: `starter.proj.json`, `starter.srs.json`, `starter.vtp.json`, and
   `starter.releases.json` (the empty change-tracking manifest). `.specpad/` is created later, on the
   first `refresh`.
3. Validate (see "Validate before finishing").

## The v1 shape

Shared envelope on every file: `schemaVersion` ("1.0"), `type`
("project" | "srs" | "vtp" | "prd" | "sdd"), `name`, `title`.

SRS item — REQUIRED `id`, `text`. Optional `code`, `satisfies`, `design`, `category`,
`securityControl`, `draft`, `hazards`, `heading`.
VTP item — REQUIRED `id`, `text`. Optional `code`, `verifies`, `expected`, `result`,
`notes`, `verificationLevel`, `kind` (`nominal` | `boundary` | `negative` | `stress` | `security`),
`securityTest`, `draft`, `heading`. `result` is one of "" | "not_tested" | "passed" | "failed".
PRD item — REQUIRED `id`, `text`. Optional `code`, `status`, `heading`. (PRD is the optional
product-requirements register; same item shape as the SRS.)
SDD section — REQUIRED `id`, `title`. Optional `code`, `body` (markdown), `source`, `kind`
(`unit` | `view`, default `unit`), `acceptance`, `segregatedFrom`, `segregationRationale`, `heading`, `level`. (The detailed design; sections are
prose, not fields — see below.)
Threat item — REQUIRED `id`, `text`. Optional `code`, `asset`, `entryPoint`, `category` (STRIDE),
`exploitability`, `impact`, `causes`, `controls`, `justification`, `safetyRisk`, `residual`, `notes`,
`heading`, `level`.
SOUP item — REQUIRED `id`, `name`. Optional `code`, `vendor`, `version`, `releaseDate`, `license`,
`url`, `purpose`, `requirements`, `runtime`, `limitations`, `endOfLife`, `endOfLifeSource`,
`usedBy`, `tests`, `maintenance`, `notes`, `heading`, `level`.
Risk item — REQUIRED `id`, `text`. Optional `code`, `hazardRef`, `severity`, `causes`, `controls`,
`justification`, `residual`, `sequence`, `notes`, `heading`, `level`. (The software risk analysis.)

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

## Detailed design (SDD) — optional downward trace

A project may add an optional **detailed design** (`<name>.sdd.json`, `type: "sdd"`): the software
units and design views that implement the requirements (IEC 62304 5.4; FDA Software Design
Specification; IEEE 1016 design views). Read `guides/detailed-design.md` before authoring one.

- **Sections are prose with a stable identity.** Each item is a section: an immutable `id`, a
  renameable `code`/`title`, a markdown **`body`**, and optional **`source`** (the repository paths it
  describes). The body carries the design — what the unit hides, its algorithm and data, interface
  behaviour for **valid and invalid** input, unit acceptance criteria — and may embed images and
  diagrams the way the SAD does. Deliberately *not* a field-per-unit record: the design has to be free
  to hold flowcharts and prose, and the `id` is what keeps it linkable while it changes.
- **The requirement points down.** An SRS requirement sets **`design`** to the SDD section **ids** that
  implement it (ids, never `code`) — mirroring `satisfies` → PRD. Tests keep verifying *requirements*;
  the trace matrix then renders PRD → SRS → SDD and SRS → VTP, so the reviewer reads the path without
  anyone having to trace a test to a design function. **Never** add a reverse link from section to
  requirement: one direction, one place to maintain, the reverse is derived on read.
- **Author at maximum rigor, always.** 62304 makes the per-unit design Class C only, and FDA submits the
  SDS only at Enhanced — SpecPad does not gate on either. Deciding what to *omit* belongs to the export.
  This is also why no safety class or documentation level appears anywhere in the schema.
- **Re-review rule (the important one).** When you change an SDD section, **every requirement whose
  `design` references it becomes suspect** — the design moved; whether the requirement still holds as
  written is now an open question. In the same job: list those requirements, decide for each whether it
  still holds, and fix the requirement or the design where it does not. This is the drift the pillar
  exists to catch, so do it explicitly rather than assuming. The reverse check too: after a code change,
  look at the sections whose `source` paths you touched.
- **Opt-in governance:** when an SDD is present, `sdd-referential-integrity` and `sdd-coverage` apply
  (see Governance). A project with no SDD pays nothing.

## Software risk (IEC 62304 clause 7) — optional

A project may add an optional **risk register** (`<name>.risk.json`, `type: "risk"`): the hazardous
situations software can contribute to, what could cause them, and what controls them. Read
`guides/risk.md` before authoring one.

- **The §7 slice only.** Hazards, foreseeable sequences of events, harms, probability estimation,
  benefit-risk and post-production monitoring belong to the **system risk management file** the quality
  system owns; `hazardRef` points at it. SpecPad produces design-control evidence, not a quality system.
- **No probability, deliberately.** For software you cannot argue probability down, so **severity**
  drives the analysis. A row made acceptable by rating the probability "remote" is the error this
  register exists to refuse.
- **A cause is a software unit** — an SDD section with `kind: "unit"` (§7.1). A design view describes
  structure across units and cannot fail on its own, so naming one is a violation.
- **A control is a requirement.** §5.2.2 requires a control implemented in software to be a software
  requirement, so `controls` holds SRS **ids**. This is what makes **§7.3 verification of risk control
  measures automatic**: the tests already verifying that requirement, and the captured run, are the
  evidence — nothing is recorded twice. A control that cannot be phrased as a requirement is not a
  software control; record where it lives in `justification`.
- **Security risk is a separate process** (62304 Ed 2, AAMI SW96, IEC 81001-5-1) and does not belong in
  this register.
- **Opt-in governance:** when a risk register is present, `risk-referential-integrity`, `risk-cause`
  and `risk-controlled` apply. A project with no risk register pays nothing.

## SOUP / off-the-shelf software — optional

A project may add an optional **SOUP register** (`<name>.soup.json`, `type: "soup"`): the third-party
software it depends on, assessed. Read `guides/soup.md` before authoring one.

- **Both regimes, one record.** IEC 62304 wants the requirements you place on the component (§5.3.3)
  and what it needs to run (§5.3.4); the FDA off-the-shelf guidance wants provenance, purpose, design
  limitations, testing, and — at Enhanced level — support and end-of-life contingency. Author all of it; what to
  omit is an export decision.
- **The version is exact**, never a range: an anomaly evaluation is only valid for the version it was
  performed against, so a range makes the assessment unverifiable.
- **Requirements on a component are text here, not SRS entries.** The requirements register holds what
  this product implements; a requirement on a supplier is neither implemented nor verified here.
- **A component may be the cause of a risk** (§7.1.2), exactly as one of your own units can: `causes`
  accepts either.
- **Development tools are not SOUP.** Compilers, bundlers, test runners and CI fall under §5.1.4 —
  none of it ships. The runtime that is not a package usually does: a language runtime, or a binary
  invoked as a subprocess.
- **End of life is a date** (`endOfLife`) with its source, not a sentence: a date can be compared to
  today, and a component already out of support is what this register exists to surface. Check the
  supplier's own announcement **and [endoflife.date](https://endoflife.date)** — the latter tracks
  published support windows for most runtimes and frameworks and will often give a date where the
  supplier's pages do not. Record which one it came from in `endOfLifeSource`. The *plan* goes in
  `maintenance`.
- **Depth is what gets these findings closed.** Every performance requirement carries a **number**
  ("renders 250 rows in under 200 ms", not "no perceptible delay"); `runtime` names versions and what
  is **not** supported; `limitations` says what is done about each one; `maintenance` names the
  re-assessment trigger. Requirements describe the component's **interface**, not its internals — it is
  a black box that will change inside without telling you. See `guides/soup.md`.
- **Known defects are not recorded here.** Evaluating published anomalies is a per-version exercise
  against a moving list, and it belongs with the bill of materials and its vulnerability feed. Two
  answers to one question means the stale one gets read.
- **This is not an SBOM.** An SBOM is a recursive inventory of every dependency, generated from the
  manifests; this is the assessed subset. Do not let one stand in for the other.
- **Opt-in governance:** when a SOUP register is present, `soup-identity`, `soup-requirements` and
  `soup-referential-integrity` apply.

## Cybersecurity (threat model and security architecture) — optional

A project may add an optional **threat model** (`<name>.threat.json`, `type: "threat"`) and a
**security architecture document** (`<name>.sec.md`). Read `guides/security.md` before authoring
either. Current regime: FDA *Cybersecurity in Medical Devices: Quality Management System
Considerations and Content of Premarket Submissions* (3 February 2026, which supersedes the June 2025
edition, aligns the guidance with the QMSR, and carries the §524B obligations), IEC 81001-5-1, and
AAMI SW96/TIR57.

- **One register, not two.** The threat model and the security risk analysis are the same document:
  identifying a threat and assessing it are one act.
- **Exploitability, not probability.** A safety risk drops probability because software fails
  deterministically; a security risk drops it because an attacker chooses when to act. Rate
  exploitability from the attacker's side — rating it low *because* of a control double-counts the
  control.
- **STRIDE is a coverage prompt**, not a label. Walk all six categories across each entry point; a
  category with no threat is a question worth answering once.
- **A control is a requirement**, as in the safety risk register, so verification comes from the trace.
- **`safetyRisk` links a threat to the harm it would cause.** That join is why security risk sits
  beside safety risk rather than inside it: a security finding with a patient consequence belongs in
  both files.
- **Threat modelling follows the MITRE/MDIC playbook's four questions** — decompose, walk
  STRIDE across each element, decide, then say what the pass did not do. Walking *elements*
  rather than listing attacks is what finds threats in the seam between two controls, and
  control categories that are empty. The **method** belongs in a procedure (the development
  plan, or a threat modelling SOP) — not restated per project. SpecPad holds the output: the
  register and the views.
- **Controls are categorised.** A requirement named as a control carries `securityControl`:
  which of FDA's eight categories (§V.B.1) it implements. The coverage argument is made from
  those categories, and an empty one is a question to answer once.
- **Four view types, and as many views as the attack surface needs.** Global system, multi-patient
  harm, updateability and patchability, security use cases. A single global view rarely carries every
  data flow: write one system-level overview, then a view per system or deployment. Where they and the
  architecture document describe the same structure, the architecture document is the source.
- **Every view has a diagram, and every connector is labelled** with what traverses it and over what
  protocol. A view that is prose alone is incomplete; so is an unlabelled arrow. Each figure carries a
  legend, and each view carries a communication-path table (Appendix 2 of the guidance).
- **Opt-in governance:** when a threat model is present, `threat-referential-integrity`,
  `threat-assessed` and `threat-controlled` apply.

## Safety classification (IEC 62304 §4.3) — declare it

The project index carries `safetyClass` (`"A"`, `"B"` or `"C"`) and `safetyClassRationale`.

**Declaring a class does not change what you write.** Author at maximum rigor whatever it says — the
class is a *record of the judgement*, which is what 4.3 asks for and what a submission stating no
class has failed to provide. Where material goes beyond the declared class, say so in a sentence
rather than dropping it: over-delivering is free, and re-deriving an omission later is not.

The rationale is the part reviewers read. Name the injury the software could contribute to and the
reasoning that places it — "no injury is possible because the device does not treat, and the worst
outcome is a delayed report" is a rationale; "Class A" alone is not.

Edition 2 replaces A/B/C with two rigor levels. It is still in ballot (publication expected around
May 2027), so classify against Ed 1.1 today.

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
  `p_` for product requirements, `d_` for design sections, `h_` for headings (e.g. `r_7f3a9c`, `d_a12b4c`).
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

### What a release entry records about itself (IEC 62304 §5.8)

Two optional fields on each release entry, both asked for at cut time rather than backfilled:

- **`anomalies`** — the defects **known to be present when this version shipped**, each with the
  `evaluation` that made shipping acceptable (§5.8.2 and §5.8.3). Every release has some; a release
  claiming none is usually a release nobody asked. Write them as a user would experience them, not as
  the code at fault, and point `ref` at the tracker entry where one exists.

  This is **not** the SOUP anomaly question (§7.1.3), which is about a supplier's published defect list
  and belongs with the bill of materials. These are your own.

- **`build`** — how the version was built (§5.8.5) and what makes that repeatable (§5.8.8): toolchain
  and versions, the environment, and where the build procedure lives. "Node 22.4.0, npm 10.8, Ubuntu
  24.04 runner; procedure in SOP-030" answers both; "CI" answers neither.

Neither is governed, because the releases manifest is not part of the document bundle governance reads.
Ask for them at the cut — an ungoverned field is one nobody is reminded about.

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
- `sdd-referential-integrity`: When an SDD is present, every SRS `design` entry resolves to an existing
  SDD section id.
- `sdd-coverage`: When an SDD is present, every non-heading SRS requirement references at least one SDD
  section via `design` — the evidence that the design implements the requirements. With no SDD, neither
  rule applies — the detailed design is opt-in, but once adopted it is checked at full rigor (see
  *Detailed design*).
- `sdd-segregation`: When an SDD is present, a section naming other sections it is `segregatedFrom`
  must say why the segregation is effective (`segregationRationale`), and each named section must
  resolve. Asks nothing of a project that claims no segregation — 5.3.5 applies where separation is
  essential to risk control, which most units are not.
- `risk-referential-integrity`: When a risk register is present, every `causes` entry resolves to an SDD
  section of kind `unit`, and every `controls` entry to an existing SRS requirement.
- `risk-cause`: When a risk register is present, every non-heading risk names at least one software item
  that could cause it (IEC 62304 7.1).
- `risk-controlled`: When a risk register is present, every non-heading risk references at least one
  controlling requirement (7.2) or records why no software control is needed. With no risk register,
  none of the three applies — software risk is opt-in.
- `soup-identity`: When a SOUP register is present, every component records a supplier and an exact
  version (8.1.2).
- `soup-requirements`: When a SOUP register is present, every component states the functional and
  performance requirements placed on it (5.3.3).
- `soup-referential-integrity`: When a SOUP register is present, every `usedBy` entry resolves to a
  design section and every `tests` entry to a test. With no SOUP register, none of the three applies.
- `threat-referential-integrity`: When a threat model is present, every `causes` entry resolves to a
  design unit or a component, every `controls` entry to a requirement, and every `safetyRisk` entry to
  a risk.
- `threat-assessed`: When a threat model is present, every non-heading threat records an exploitability
  and an impact.
- `threat-controlled`: When a threat model is present, every non-heading threat references at least one
  controlling requirement or records why none is needed. With no threat model, none of the three
  applies.

Also confirm structural validity: required fields present, `result` within its enum,
`schemaVersion` is "1.0".

### The advisory tier

Four rules **report without failing**. They exist because not everything worth saying is a defect: a
rule that fires on every requirement in an established project on the day it ships teaches people to
ignore governance rather than to use it, and material beyond a declared safety class needs pointing at
without being called wrong.

- `srs-category`: Every non-heading SRS requirement should declare which of IEC 62304 5.2.2 a)–l) it
  is (`category`) — **one or more**, since A1:2015 NOTE 10 states the categories can overlap. Advisory.
- `srs-security-control`: A requirement a threat names as a control should declare which FDA security
  control categories it implements (`securityControl`). Asked only of requirements the threat model
  already leans on. Advisory.
- `vtp-negative-path`: A requirement whose tests are all `nominal` should also be tested on a
  boundary, a refusal, or under load. Adoption is judged **per requirement**, from that requirement's
  own tests — a requirement whose tests declare no `kind` at all is left alone, so classifying one test
  cannot raise an advisory against every requirement not yet classified. A near 1:1 register of
  requirements to tests is the shape that produces this. Advisory.
- `vtp-verification-level`: Every non-heading VTP test should declare whether it is `unit`,
  `integration` or `system` verification — 62304 5.5, 5.6 and 5.7 are three activities with distinct
  records (`verificationLevel`). Advisory.
- `sdd-unit-trace`: A requirement whose `design` references resolve **only** to sections of kind
  `view` should also reach a software unit. A view describes structure across units and implements
  nothing on its own — the same reason `risk-cause` requires a unit. Catches the reference that
  resolves but resolves to the wrong kind of thing, which plain referential integrity cannot. Advisory,
  because a genuine model-level invariant can legitimately live only in a view. Advisory.
- `sdd-acceptance`: Every SDD section of kind `unit` should state its `acceptance` criteria — what
  "verified" means for it (5.5.3; at Class C also 5.5.4). Not asked of a design view. Advisory.
- `risk-sequence`: Every non-heading risk should record the `sequence` of events from the software
  failure to the hazardous situation (7.1.5). Advisory.

**When you draft, fill them in anyway.** Advisory describes what governance does about an omission, not
whether the field matters — a new specification you write should have both set on every item, because
the point of this tier is to spare *existing* projects a flag day, not to excuse a thin first draft.

A project adopts a rule by naming it in the index's `enforce` array, which moves its findings into the
blocking set:

```json
{ "type": "project", "enforce": ["srs-category", "vtp-verification-level"] }
```

Recommend that once a project's backlog is filled in — it is the difference between a practice and an
intention.

## Validate before finishing

Before ending any task that touched these files:
1. Re-read each changed JSON file and confirm it parses.
2. Confirm required fields and the `result` enum.
3. Run the three governance rules above across the SRS+VTP pair.
4. Report any remaining violations to the user (warnings don't block saving, but do block
   "done").
