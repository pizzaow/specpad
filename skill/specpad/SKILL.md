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
- `<name>.jobs.json` — optional **jobs register** (no-tracker case). Type `jobs`. Holds job *records*
  only — `{ id, code?, title, description?, status: "open"|"closed" }` — and **no change
  associations** (which items/commits a job touched is derived from git via the `Job:` trailer).
  `job.json`'s `job` points at the active record's **`id`**. A closed record's scope is sealed: don't
  re-activate it — create a new record for further work.
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
   - `version`: the tag name as-is (e.g. `"v1.0"`).
   - `ref`: the resolved commit SHA — `git rev-parse <tag>^{commit}` (dereferences annotated tags to their target commit).
   - `date`: `git log -1 --format=%cs <tag>` (commit date, `YYYY-MM-DD`).
   - `author`: the author of the tagged commit — `git log -1 --format='%an	%ae' <tag>` →
     `{ "name": ..., "email": ... }`. (This is **release-granularity** "who", not per-item.)
   - `snapshot`: `null` for now (filled in only when cached).
3. Regenerate `.specpad/baseline/` from the newest matching tag: for each spec file
   `git show <tag>:docs/specpad/<file>` and write it under `docs/specpad/.specpad/baseline/` mirroring the
   top-level file names. Set that release's `snapshot` to `".specpad/baseline"` and set the top-level
   `baseline` to that version.
4. Re-validate every JSON file you wrote.

If there are **no matching tags**, write a manifest with `baseline: null` and `releases: []` (copy
`templates/starter.releases.json`); the editor degrades gracefully.

### `pull <version>` — cache an older snapshot on demand
`git show <ref>:docs/specpad/<file>` for each spec file into `.specpad/snapshots/<version>/`
(mirroring top-level names), then set that release entry's `snapshot` to that path. Do **not** diff.

### Jobs register (`<name>.jobs.json`) — when there is no external tracker
The register holds job **records** only — `{ id, code?, title, description?, status }` — and **no
change associations** (which items and commits a job touched is derived from git, never stored).
Maintain it as authoritative metadata (it is **not** part of the regenerable `.specpad/` cache):
- **Create** it the first time the user tracks work without a tracker (or let them create it in the
  editor's Jobs tab). Generate each record's `id` like any other key — a `j_` prefix + 6 hex digits,
  unique within the file, immutable. `code` (e.g. `JOB-1`) is a human label, freely renameable.
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

Also confirm structural validity: required fields present, `result` within its enum,
`schemaVersion` is "1.0".

## Validate before finishing

Before ending any task that touched these files:
1. Re-read each changed JSON file and confirm it parses.
2. Confirm required fields and the `result` enum.
3. Run the three governance rules above across the SRS+VTP pair.
4. Report any remaining violations to the user (warnings don't block saving, but do block
   "done").
