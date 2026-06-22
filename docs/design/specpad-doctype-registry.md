# SpecPad — Document-Type Registry — Design

**Date:** 2026-06-22
**Status:** Implemented (JOB-25 registry + JOB-26 PRD tab + JOB-27 generator default)
**Builds on:** `specpad-v1-design.md` (contract), `specpad-change-tracking-design.md` (snapshots/jobs)

## 1. Purpose

SpecPad started with two content document types (SRS, VTP) and grew to four (+ PRD, + the arc42
architecture). More pillars are coming — SOUP/SBOM, cybersecurity, SDD. Previously each type was
**hard-coded in ~12 places** (validators, factories, the file classifier, snapshot loaders, the editor's
change-tracking, the deploy manifest, the skill's snapshot/cache/generator prose). Adding a type meant
editing all of them.

This design introduces a **single document-type registry** so adding a pillar is **one registration**, and
the machinery — release/baseline snapshots, per-job before/after diffs, the redline, validation, the
reference page, and the baseline generator — flows from it automatically.

## 2. The two pieces

1. **The registry — `src/shared/docTypes.ts` (`DOC_TYPES`).** The contract's source of truth for *content*
   document types. Each entry:
   `{ type, label, kind: 'register'|'prose'|'asset', optional, inBaseline, generate, schema? }`.
   - `register` — id-keyed JSON with `items[]` (srs, vtp, prd, future soup/sdd/cyber). Diffed by the
     shared `diffItems` (by stable id) — that's what makes snapshots/diffs/redline type-generic.
   - `prose` — tracked markdown (the SAD + its guide), line-diffed. `asset` — diagrams (SVG), coarse.
   Helpers: `REGISTER_TYPES`, `docTypeFor`, `isRegisterType`, `registerTypesInIndex`.
   *Sidecars* (project index, releases, job marker, jobs register) are infrastructure, not content, so
   they live outside the registry (the validator adds them explicitly).

2. **The project index — `<name>.proj.json` `documents[]`.** The *per-project* list of which content docs
   this project actually has. Snapshot, job-diff, redline, and the generator **iterate `documents[]`** and
   consult the registry for *how* to handle each type, rather than hard-coding `srs`/`vtp`.

The registry says *what types can exist and how they behave*; the index says *which a given project uses*.

## 3. What derives from the registry (no per-type edits)

- **Validation** (`validate.ts`) and the **schema reference** (`generate-reference.ts`) are built from
  `DOC_TYPES` (+ the fixed sidecars).
- **File classification / loaders** (`localFileApi.ts`): `classifyDocFilename`'s pattern is built from the
  register types; `loadSnapshot`/`loadJobSnapshot` take a generic `type: string`.
- **Snapshots & caches** (skill prose): the release/baseline snapshot and the per-job before/after cache
  cover "every document in the project index + the architecture files" — iterate, don't list.
- **Per-job diffs & redline** (`LocalApp.tsx`): `loadJobCaches` and the active-job in-progress diff iterate
  the register types and diff by id (`JobDiff = Record<docType, DocDiff>`); `JobsView` renders one
  `DiffList` per type present (`RegisterDiffs`). The since-baseline redline reuses `buildRedlineRows`.
- **The generator & init** (skill): adoption drafts the project's *configured* document types (default
  PRD + SRS + VTP + starter SAD); `createProjectDoc` builds `documents[]` from `REGISTER_TYPES`.
- **The deploy demo manifest**: any `<name>.<type>.json` except the sidecars.

## 4. Recipe — adding a new pillar (e.g. SOUP / cybersecurity / SDD)

For an id-keyed **register** type, the minimum:

1. **Schema** — add `<x>Schema` to `src/shared/schema.ts` (and a `…Doc`/`…Item` type) for the new
   `items[]` shape.
2. **Register** — add a `DOC_TYPES` entry in `src/shared/docTypes.ts` (`kind: 'register'`, the schema,
   `optional`, `inBaseline: true`, `generate`).
3. **Index** — list it in projects that want it (or rely on `createProjectDoc`/init scaffolding it).

That alone makes it **validated, snapshotted (baseline + per-job), diffed, redlined, demo-carried, and
draftable by the generator** — no edits to the snapshot, diff, redline, generator, or deploy code.

To make it **editable in the browser**, add a view (a register table) + a `ViewTabs` entry — as PRD did
with `PrdTable`. (A future generic register table could remove even this step.)

Prose/asset pillars (like a new diagram set) attach to the architecture file group rather than the
register path.

## 5. Non-goals / notes

- The registry holds *content* types only; sidecars stay explicit (they're not project documents).
- `DocType`/`ProjectDocRef`/the project-schema enum are still explicit unions — editing them is part of
  "registering a type", which is acceptable; the point is that the *behavioural* code paths don't change.
- Per-job PRD diffs appear automatically; the PRD editor tab (JOB-26) and any future type's editor view
  are the one place a per-type UI is still added by hand.
