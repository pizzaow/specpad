# SpecPad — Skill + Editor — v1 Design

**Date:** 2026-06-05
**Status:** Draft for review

## 1. Purpose

SpecPad is a **distributable product**: a Claude Code skill that governs structured software
documentation (requirements + tests + a project index), paired with a hosted visual editor. The
skill writes and validates structured JSON files; humans edit the same files through a full web UI.
The two are co-governed by one shared contract.

This replaces an earlier lightweight, `.md`-based skill, whose prose format is not editor-friendly.

### Primary goal
A polished, frictionless thing other people can install — not just a personal tool. Install
friction ("just open it and edit") is a first-class requirement.

### v1 scope
A small linked hierarchy of three document types: a **project/overview index**, an **SRS**
(requirements), and a **VTP** (verification tests). Everything else ("more powerful functions to
describe software") is explicitly deferred to v2+ and must not bloat v1.

## 2. Architecture overview

```
Claude Code skill ──writes/validates──┐
                                       ▼
                          docs/specpad/ directory in user's git repo
                          ├── index.html        (generated launcher)
                          ├── <name>.proj.json
                          ├── <name>.srs.json
                          └── <name>.vtp.json
                                       ▲
       Hosted editor (versioned static build on specpad.com) ──reads/writes
       via File System Access API (secure context = https)
```

Three independently-understandable units:

1. **The contract** — the v1 JSON schema + a shared validation module. The single source of
   truth both other units obey.
2. **The skill** — a Claude Code skill that scaffolds the directory, writes/edits the JSON
   programmatically, and runs governance checks against the contract.
3. **The editor** — a versioned static web app (an evolution of the carried-over React app) that
   reads and writes the same files via the File System Access API and runs the same governance
   checks as live UI feedback.

## 3. Runtime & distribution model

**Decision: hosted-only for v1.** The skill generates a tiny `index.html` in `docs/specpad/` whose
only job is to redirect to the **version-pinned** hosted editor:
`https://specpad.com/v01/?name=<project>&open=<doc>`

- A **hosted https page is a secure context**, so the File System Access API works there — which a
  double-clicked `file://` page cannot reliably provide. This is the core reason for the redirect
  model.
- **Version path convention:** `schemaVersion: "1.0"` maps to editor build path `/v01/`
  (`"2.0"` → `/v02/`, etc.).
- **Version pinning:** files carry `schemaVersion`; `index.html` redirects to the editor build that
  supports that version (`/v01/`). Old versioned builds stay live at stable URLs forever, so files
  written by an old skill always open in a compatible editor. This converts the skill↔UI contract
  problem into a deployment problem (keep versioned builds online).
- **Hard constraint (must be designed around):** a URL **cannot** auto-grant filesystem access.
  Parameters can carry `schemaVersion`, project name, and which doc to open, but the user must click
  the native "choose folder" picker at least once per session. (Chrome can persist that grant across
  sessions; design for it, don't depend on it.)
- **Local-server fallback is deferred** (see §9). v1 ships hosted-only.

## 4. The contract: v1 schema

Guiding principle: **the JSON Schema enforces only structural validity. All policy
(traceability, referential integrity, "a real test needs an expected result") lives in the
governance layer** (skill checks + UI checks). This keeps the file format trivially simple and
forgiving while the *system* stays strict — and rules can change without versioning the on-disk
schema.

Applied rules:
- **One stable key per row (`id`), generated, immutable; all references target it** — never a human
  label. Renames can't break links.
- **Git owns history.** No `modifiedUser`/`modifiedDate`/`changeListNum`/`nextCL`/`prevCL`/change-codes.
- **Nothing derived is stored.** No `numTests`, no per-requirement result roll-ups — computed on read.
- **`schemaVersion` on every file** — drives the launcher's editor-version redirect.
- **No frozen taxonomies.** Labels and tags are free-form; naming policy lives in the skill, not regex.

### Shared envelope (all files)
```jsonc
{
  "schemaVersion": "1.0",
  "type": "project" | "srs" | "vtp",
  "name": "AcmeApp",         // short system name
  "title": "Requirements"    // human-readable doc title
}
```

### `*.proj.json` — index only
```jsonc
{
  "schemaVersion": "1.0",
  "type": "project",
  "name": "AcmeApp",
  "title": "AcmeApp System",
  "description": "",                 // optional, free text
  "documents": [
    { "type": "srs", "path": "AcmeApp.srs.json", "title": "Requirements" },
    { "type": "vtp", "path": "AcmeApp.vtp.json", "title": "Verification Tests" }
  ]
}
```
No owners, stakeholders, repositories, settings, dependencies, status, PM metadata, or version
counters. Add back as optional fields only on demonstrated need.

### `*.srs.json` — requirements
```jsonc
{
  "schemaVersion": "1.0",
  "type": "srs",
  "name": "AcmeApp",
  "title": "Requirements",
  "items": [
    {
      "id": "r_7f3a9c",   // stable key, generated, immutable — REQUIRED
      "code": "FUNC-1",   // optional human label, free-form
      "text": "The system shall authenticate users with a username and password.", // REQUIRED
      "tags": ["auth"],   // optional
      "hazards": ["SEC-1"]// optional, free-form strings
    },
    {
      "id": "h_001",
      "heading": true,    // section header; groups items, no requirement semantics
      "text": "Functional Requirements"
    }
  ]
}
```
**Required per item: `id`, `text`.** All else optional.

### `*.vtp.json` — tests
```jsonc
{
  "schemaVersion": "1.0",
  "type": "vtp",
  "name": "AcmeApp",
  "title": "Verification Tests",
  "items": [
    {
      "id": "t_a12b",                 // stable key — REQUIRED
      "code": "TEST-1",               // optional human label
      "text": "Navigate to login, enter valid credentials, submit.", // REQUIRED
      "verifies": ["r_7f3a9c"],       // refs SRS item *id*s (stable keys); optional at schema level
      "expected": "User is authenticated and lands on the dashboard.", // optional
      "result": "passed",             // "" | "not_tested" | "passed" | "failed"; optional
      "notes": "",                    // optional
      "tags": []                      // optional
    }
  ]
}
```
**Required per item: `id`, `text`.** `verifies`/`expected`/`result` are structurally optional.

### Governance rules (NOT in JSON Schema — enforced by skill + UI)
- Every non-heading requirement is verified by ≥1 test (traceability).
- Every `verifies` entry resolves to an existing SRS item `id` (referential integrity).
- Non-heading tests have a non-empty `expected`.
- Optional naming conventions for `code`, if desired.

### Confirmed cuts/keeps
- `vendor` — **cut**.
- `code` (human label) — **kept, optional**.
- `hazards` — **kept, optional** free-string array.
- `heading` — **kept** as a minimal boolean flag.

## 5. Components

### 5.1 Shared validation module (the contract enforcement point)
A single small module (plain JS/TS, zero heavy deps) exporting:
- the v1 JSON Schema documents (project / srs / vtp), and
- `validate(doc)` → structural errors, plus
- `checkGovernance(projectDocs)` → policy violations (traceability, referential integrity, missing
  expected results).

Both the skill (via Node) and the editor (via import) call the **same** module, so the two layers
can never drift. This is the one piece of shared infrastructure v1 intentionally invests in —
it is the contract, not bloat.

### 5.2 The skill
A Claude Code skill that:
- Scaffolds `docs/specpad/` with the generated `index.html` and starter `*.proj/srs/vtp.json` on init.
- Creates/edits items programmatically, generating stable `id`s.
- Runs `validate` + `checkGovernance` and reports/fixes violations before finishing.
- Replaces the existing `.md`-based skill.

### 5.3 The editor
The carried-over React app (`LocalApp.tsx`, `SRSTable`, `VTPTable`, `TestingView`,
`localFileApi.ts`), upgraded to:
- speak the v1 schema (replacing `src/types.ts`'s `id`/`testid` model),
- reference items by stable `id`, compute `numTests`/roll-ups on read,
- run the shared validation module for live UI checks,
- build to a **versioned, self-contained static bundle** deployed at `specpad.com/v01/`.

`localFileApi.ts` (File System Access integration + fallback) is schema-agnostic and reused largely
as-is; the table components and `types.ts` are the primary refactor targets. A deep code-level
rebrand (file names `autodoc.less`/`autodocutils.js`, identifiers) is an early build task.

### 5.4 Hosting / DNS — CloudFront + S3 (deployment-phase)
**Decision: S3 + CloudFront.** `specpad.com` is owned in Route 53 (account `904915073567`) but
**has no hosted zone or DNS records yet**. Standing up the editor requires:
1. Create the `specpad.com` hosted zone in Route 53.
2. S3 bucket holding versioned static builds (`/v01/…`), private, served only via CloudFront (OAC).
3. CloudFront distribution in front of the bucket; ACM cert (us-east-1) for `specpad.com`.
4. Route 53 A/ALIAS record → CloudFront.

Not a blocker for v1 design; tracked for the deployment plan.

## 6. Data flow

1. User invokes the skill in a repo → skill scaffolds `docs/specpad/` (or updates existing).
2. Skill writes/edits requirements and tests as structured JSON, validating against the contract.
3. User double-clicks `docs/specpad/index.html` → redirected to the pinned hosted editor.
4. User grants folder access once via the native picker, edits visually; the UI validates live.
5. User commits via git; git is the history/merge layer between skill edits and human edits.

## 7. Error handling
- **Schema-invalid file:** editor and skill surface structural errors from `validate`; editor opens
  the file read-only / in a recovery state rather than corrupting it.
- **Governance violations:** reported as warnings (non-blocking to *open*, blocking to skill
  "done"), e.g. "REQ r_7f3a9c has no verifying test."
- **Unsupported `schemaVersion`:** launcher redirects to the matching build; if none exists, the
  editor shows a clear "this file needs editor version X" message.
- **No File System Access API (Firefox/Safari):** fall back to manual upload/download (current
  behavior).
- **Dangling `verifies` ref:** flagged by referential-integrity check; not auto-deleted.

## 8. Testing
- **Shared validation module:** unit tests for structural validation and each governance rule
  (valid docs pass; each violation type is caught).
- **Schema fixtures:** golden valid/invalid sample files per type.
- **Editor:** load → edit → save round-trip preserves structure and stable `id`s; live-check
  surfaces seeded violations.
- **Skill:** scaffold produces schema-valid starter files; edits keep files valid; governance
  failures are reported.

## 9. Explicitly deferred (v2+)
- **Local-server fallback** (`npx <editor-package>` serving the same bundle from localhost for
  offline/air-gapped/privacy use). v1 is hosted-only.
- Additional doc types (hazard, trace, architecture/design).
- Richer project metadata, in-file change tracking, configurable naming taxonomies, coverage
  dashboards.

## 10. Open decisions to confirm at review
Resolved: directory = `docs/specpad/`; host = `specpad.com`; hosting = S3 + CloudFront; editor base
= carry over the React source; runtime = hosted-only (local server deferred).

Still open:
1. **Skill ↔ shared-module mechanics:** does the skill shell out to a bundled `node validate.mjs`,
   or is validation re-expressed as skill instructions? (Proposed: shared module via Node, to avoid
   drift.)
2. **`id` generation scheme:** short random slug (e.g. `r_7f3a9c`) vs UUID. (Proposed: short slug.)
3. **Toolchain:** keep the carried-over webpack/Bootstrap-3 setup, or modernize (e.g. Vite) during
   the schema refactor. (Proposed: keep for now; modernize opportunistically.)
