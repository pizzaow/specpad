# SpecPad — Integrations & Upstream Traceability — Design

**Date:** 2026-06-20
**Status:** PRD register approved & implemented (JOB-16); the rest is forward design (not yet built)
**Builds on:** `docs/design/specpad-v1-design.md` (contract), `specpad-change-tracking-design.md`
(git-derived change tracking, jobs)

## 1. Purpose

This addendum captures five onboarding/integration questions that came up after the jobs +
change-tracking + architecture + release work shipped (v1.2). They share one through-line:

> **Everything is a repo-resident, job-attributed, git-diffed register — never an external sync.**
> Where an external system (Jira, Confluence, screenshots) touches SpecPad, we *pull a snapshot at
> the moment of value* and store the result, rather than maintaining a live link. This keeps the
> core static and offline, keeps regulatory evidence self-contained in git, and confines messy
> integrations to opt-in add-ons.

Only **§4 (the PRD register)** is implemented now. §2, §3, §5, §6 are recorded design intent.

## 2. Jira / Confluence ingestion (add-on, triggered at job start)

**Decision: a separate add-on skill (`specpad-jira`), not core; triggered when you begin a job.**

- Core stays static and offline-clean; Jira/Confluence bring auth, network, and org-specific field
  mappings. This mirrors the core/medical split: core defines the seam, the add-on fills it.
- The jobs register already has the seam: a `JobRecord.code` holds the human label (e.g. `PROJ-123`),
  the stable `id` flows through the `Job:` commit trailer. Ingestion *seeds a JobRecord from an issue*,
  keyed by `code` — it does not make the tracker a system of record.
- **Trigger = job start** (the moment of highest value): `specpad job PROJ-123` fetches the issue,
  drafts the JobRecord (title/description/type from the issue), sets it active, and hands the issue
  text to the requirement-capture loop so the first SRS/PRD drafts are informed by product intent.
- **Pull, not push. No git hook.** Ingestion is interactive (you choose what to work on), not a
  commit-time gate. Optional `specpad sync jobs` refreshes titles/status/closure on demand.
- **Store the link, not the copy.** Keep the Jira *key* in the repo (stable reference); do not mirror
  Jira's evolving body/comments/workflow state.
- **Confluence** is prose, not work items — treated as an *import* source (§3), not per-job ingest.

This add-on directly feeds §4: an ingested issue is often the PRD entry in prose form.

## 3. Onboarding an existing project — two paths, routed by `init`

There are two distinct ways to absorb an existing project; `init` asks and routes:

- **`import` (from existing DHF docs)** — parse the SAD/SRS/VTP/release history you already have into
  structured SpecPad. Source of truth = your documents. A *new, guided, per-document-type walk*
  ("point me at your SRS / VTP / SAD / releases; I parse what I can and draft the rest").
- **`baseline` (from source code)** — the code exists but there is no formal documentation; derive a
  `draft`-tagged SRS/VTP from the code. Source of truth = the code. **Already built** (the baseline
  generator).

`init` quiz: *Do you have existing requirement/test/architecture documents?* → **Yes** routes to
`import`; **No, just code** routes to `baseline`; **Greenfield** just scaffolds.

### 3.1 Baseline-at-a-tag (the "classic documentation" boundary)

Everything at/before an adoption tag (e.g. `4.0`) is one **frozen baseline release** — "classic
documentation". It still gets full SRS + VTP entries (the value: structured, traceable requirements
even for legacy), but it is **not** decomposed into per-job change controls (there were no jobs then —
don't fabricate them). One snapshot under `.specpad/baseline/`, tagged as the baseline release, with
an empty (or single synthetic "pre-adoption baseline") job set. This is the *same boundary* the
pre-push hook already uses (it skips pre-adoption history): **before the adoption tag → classic /
no job required; after → full change controls.**

### 3.2 You baselined from code, then later found the DHF

**Do not start over and do not re-baseline.** Run **`import` on the found docs, then `audit`** to
reconcile. The code-baseline and the DHF are two independent observations of the same system: the DHF
is higher authority for *intent*, the code-baseline for *current behavior*. Import is additive
(idempotent merge — match on intent, never duplicate); `audit` (already built; reconciles spec↔code
both directions) surfaces the gaps: documented-but-not-implemented and implemented-but-undocumented.
The union is strictly better than either source alone — and is itself good regulatory evidence
(DHF and code were cross-checked, gaps explicitly identified). The only new work is making `import`
safe to run against an already-baselined repo.

## 4. PRD register — product requirements & upward traceability (IMPLEMENTED)

**62304 does not mandate a "PRD".** It requires SRS ↔ verification. The broader *design-control*
picture (FDA design controls; what an eQMS trace matrix shows) wants **user needs / PRD ↔ SRS ↔
verification + validation**, where validation traces to user needs / intended use. So PRD entries are
the anchor for **validation** and are what device companies actually maintain (PRDs and/or user
stories) — worth supporting, not worth pretending 62304 forces.

**Key decision (per the user): store PRD changes the same way we store SRS changes — repo-resident,
job-attributed, git-diffed — rather than syncing.** This sidesteps the sync problem entirely.

Implemented in the contract:

- **`<name>.prd.json`** (`type: "prd"`) — an optional register with the **same item shape as the
  SRS** (stable `id`, renameable `code`, `text`, optional `heading`/`level`/`tags`). Item id prefix
  `p_`. Reuses the diff, table, and (forward) cache machinery.
- **`SrsItem.satisfies?: string[]`** — an SRS requirement traces upward to PRD item **ids** (never
  codes), mirroring how `VtpItem.verifies` targets SRS ids. So the full chain is
  **PRD → SRS → VTP**, with jobs as the orthogonal change axis cutting across all three.
- **Opt-in governance** (only when a PRD register is present, so generic projects pay nothing):
  - `prd-referential-integrity` — every SRS `satisfies` entry resolves to a PRD item id.
  - `prd-coverage` — every non-heading PRD item is satisfied by ≥1 SRS requirement (a product
    requirement nobody implements is a real gap).

**Deriving PRD entries from a job:** when work starts (especially seeded by §2 Jira context), the job
description *is* product intent. The skill proposes a PRD entry; the human ratifies. This is the
working loop one level up — but *coarser* than SRS derivation, because the code constrains the SRS
(you can read what it does) while it does **not** tell you the product/market *why*. So PRD drafts
lean on the job description + ingested context and need more human ratification; never auto-finalize a
PRD from code alone.

**Not collapsed into jobs:** a job is a unit of *change* (closes, tied to commits); a PRD entry is a
unit of *product intent* (long-lived, predates/outlives any one job). A job *implements* PRD entries;
an SRS item *traces to* them.

**Validation testing (next):** verification (VTP) traces to the SRS; **validation** traces to the
PRD (does the product meet user needs — the FDA verification-vs-validation distinction). Once PRD
entries exist, a validation test plan (`<name>.val.json`) whose items `validate: [prdId]` is the
clean follow-on. Phase it: PRD register + SRS→PRD trace first (done), validation tests after.

**Editor (next slice):** the contract, governance, and dogfood ship now; a PRD tab/view in the editor
(reusing `SRSTable`) and a "Product requirements changed" section in the job detail (reusing the
diff/cache plumbing — `diffDocs` already accepts PRD docs) are the next editor slice.

## 5. Multi-repo devices — pin, don't couple

**Decision: do not auto-tie repos together.** Each repo keeps its own SpecPad (own contract instance,
jobs, SAD, releases, and — if used — PRD). A live cross-repo linkage would need a shared backend or a
monorepo assumption; both break the static, git-is-the-substrate model and neither matches how
firmware / reconstruction / visualization teams actually work (independent release cadences).

Instead, a lightweight **hand-authored system-level document** (a "system DHF" / device master, its
own repo) **references** each subsystem's SpecPad by repo URL + version tag — a system-of-systems SAD
plus a pinning table ("Device release 2.1 = firmware v4.0 + recon v3.2 + viz v1.8"). **The link is a
version pin in a parent doc, not a live reference** — pins are stable regulatory evidence ("which
versions composed this device release"); live references rot. A future *system-release* entity could
structure this (its "jobs" being component version bumps), additive and requiring no repo coupling.

## 6. Usability / interface specification — impact assessment & before/after report

Goal: **assist an impact assessment.** The highest-value output is a confident *"this job did NOT
touch usability"* (saves a re-evaluation); otherwise, as much "how" as possible.

- **First pass (cheap, automatic):** reuse the coarse, job-level coupling built for architecture.
  Define a "usability surface" at init (UI component dirs, route/screen files, user-facing string
  catalogs, interaction handlers). Per job: did any commit touch that surface? **No → "no usability
  impact" (high confidence).** Yes → flag + extract which screens/components/strings/routes changed.
  All git-derivable, fits the existing per-job diff cache.
- **Interface spec** = another tracked document with job-coupled change history, treated like the SAD
  (arc42-style markdown + flow diagrams, Edit/Display, per-job coarse diff + section diff, release
  snapshot). "Did this job change the interface, and how" becomes answerable through existing plumbing.
- **Technical report (the deliverable):**
  - *Before/after workflow flowchart* — very doable: if the interface spec includes draw.io flow
    diagrams, "changed yes/no" is the existing coarse diagram signal, and the report renders vN-1 and
    vN flows side by side (the same before/after we produce for releases).
  - *Before/after screenshots* — higher value, harder: **SpecPad is static and has no runtime, so it
    cannot capture screenshots itself.** Route (a): the team/CI drops screenshots into interface-spec
    assets and we lay out before/after by screen. Route (b): an add-on hooks Playwright/Storybook in
    *their* CI. Ship (a) first; never promise auto-capture from core.

This feeds §4: an interface change → a usability validation test → traces to a PRD/user need. §4 and
§6 reinforce each other (PRD/validation is the trace target, the interface spec is the design
artifact, jobs are the change axis).

## 7. Sequencing

1. **PRD register + SRS→PRD trace** — done (JOB-16); unblocks validation and usability tracing.
2. **`import` + baseline-at-tag** (§3) — real adoption needs it.
3. **Interface-spec / usability pillar** (§6) — mostly reuse of architecture machinery.
4. **Jira ingestion add-on** (§2) — contained, opt-in, whenever wanted.
5. **Multi-repo** (§5) — a documentation pattern + a future system-release entity, not near-term code.

None fork the contract or the editor — all are additive registers + optional governance rules,
consistent with the core/medical split.
