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

## Files and naming

- `docs/specpad/<name>.proj.json` — project index
- `docs/specpad/<name>.srs.json` — requirements
- `docs/specpad/<name>.vtp.json` — verification tests
- `docs/specpad/index.html` — generated launcher (opens the hosted editor)

Every file carries `"schemaVersion": "1.0"`.

## Scaffolding a new project

1. Create `docs/specpad/` if missing.
2. Copy the templates from this skill's `templates/` folder, replacing every `PROJECT_NAME` token
   with the system's short name: `starter.proj.json`, `starter.srs.json`, `starter.vtp.json`, and
   `starter.releases.json` (the empty change-tracking manifest). `.specpad/` is created later, on the
   first `refresh`.
3. Validate (see "Validate before finishing").

## The v1 shape

Shared envelope on every file: `schemaVersion` ("1.0"), `type`
("project" | "srs" | "vtp"), `name`, `title`.

SRS item — REQUIRED `id`, `text`. Optional `code`, `tags`, `hazards`, `heading`.
VTP item — REQUIRED `id`, `text`. Optional `code`, `verifies`, `expected`, `result`,
`notes`, `tags`, `heading`. `result` is one of "" | "not_tested" | "passed" | "failed".

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
- `.specpad/baseline/` — raw snapshot of the spec files at the latest release (always present once
  refreshed).
- `.specpad/snapshots/<version>/` — raw snapshots of older releases, pulled on demand and then kept.

`.specpad/` is a normal committed directory (deliberately not named `.cache/`, which many global
gitignores exclude). It holds **only verbatim copies** of past spec files — never diffs.

### `refresh` — keep the manifest and baseline current (idempotent)
Run at release time or on request:
1. Determine the tag pattern: use `tagPattern` from `<name>.releases.json` if present, else default
   `v*`. List matching tags newest-last: `git tag --list '<pattern>' --sort=creatordate`.
2. For every matching tag not already in `releases.json`, append an entry
   `{ version, ref, date, author, snapshot }`:
   - `date`: `git log -1 --format=%cs <tag>` (commit date, `YYYY-MM-DD`).
   - `author`: the release's tagger/committer — `git log -1 --format='%an	%ae' <tag>` →
     `{ "name": ..., "email": ... }`. (This is **release-granularity** "who", not per-item.)
   - `snapshot`: `null` for now (filled in only when cached).
3. Regenerate `.specpad/baseline/` from the newest matching tag: for each spec file
   `git show <tag>:docs/specpad/<file>` and write it under `.specpad/baseline/` mirroring the
   top-level file names. Set that release's `snapshot` to `".specpad/baseline"` and set the top-level
   `baseline` to that version.
4. Re-validate every JSON file you wrote.

If there are **no matching tags**, write a manifest with `baseline: null` and `releases: []` (copy
`templates/starter.releases.json`); the editor degrades gracefully.

### `pull <version>` — cache an older snapshot on demand
`git show <ref>:docs/specpad/<file>` for each spec file into `.specpad/snapshots/<version>/`
(mirroring top-level names), then set that release entry's `snapshot` to that path. Do **not** diff.

### Commit workflow (jobs)
Each commit should carry its spec/test edits and a job. When you commit on the user's behalf:
- If `<name>.job.json` exists, add a `Job: <job>` trailer to the commit message.
- Pre-commit check (name-level, **not** a semantic diff): if code files are staged, confirm the
  related `docs/specpad/*.json` are staged too when requirements/tests changed — use
  `git diff --cached --name-only`. Warn if spec/test updates look missing.

### On-demand reports (advisory prose, never cached)
When asked "what changed for the next release", "trace job PROJ-123", or "who last changed r_x":
walk git directly (`git log`, `git describe --tags`, `--grep='Job: PROJ-123'`) and summarize in prose.
These are advisory; they are not written to the cache and nothing depends on them.

## Governance — enforce before finishing

These rules are the contract. They mirror the shared validation module exactly; keep them
in sync. Run them mentally (or with the editor) and fix or report every violation before
declaring a task done:

- `traceability`: Every non-heading SRS requirement is referenced by at least one VTP test.
- `referential-integrity`: Every VTP `verifies` entry resolves to an existing SRS item id.
- `missing-expected`: Every non-heading VTP test has a non-empty `expected` value.

Also confirm structural validity: required fields present, `result` within its enum,
`schemaVersion` is "1.0".

## Validate before finishing

Before ending any task that touched these files:
1. Re-read each changed JSON file and confirm it parses.
2. Confirm required fields and the `result` enum.
3. Run the three governance rules above across the SRS+VTP pair.
4. Report any remaining violations to the user (warnings don't block saving, but do block
   "done").
