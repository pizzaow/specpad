# SpecPad — Change Tracking (Git-Derived) — Design

**Date:** 2026-06-07
**Status:** Approved for implementation (feature v1)
**Builds on:** `docs/design/specpad-v1-design.md` (the v1 contract, runtime, and redirect model)

## 1. Purpose

SpecPad deleted its old, heavyweight change-control system in favor of git (no
`modifiedUser`/`modifiedDate`/changelist/change-code fields; "git owns history"). This feature
restores the *useful* capabilities of that old system as **read-side views derived from git**,
surfaced in the editor UI, without re-introducing stored history or changing the spec schema.

Five user-facing capabilities are in scope:

1. **Redline** — see which uncommitted requirement/test changes have been made, so each code
   check-in carries its associated spec/test edits.
2. **Since last release** — see everything modified for an upcoming release (e.g. `v26.1 → HEAD`),
   regardless of how many commits fell in between.
3. **Arbitrary version diff** — compare any two tagged versions (e.g. `v24.0 → v26.0`) as a report.
4. **History / attribution** — for an item, see when/where it was added and last changed
   (version granularity), with commit-level drill-down on demand.
5. **Jobs** — associate each commit with an assignable dev unit (Jira-style), and trace
   **job → SRS → VTP → source code**.

## 2. Core idea

Every capability is **one pure primitive plus git metadata**, with a thin, regenerable cache so the
editor — which has **no git access in the browser** — can render all of it in the UI.

- **The primitive:** a semantic, `id`-keyed diff of two SpecPad documents. Pure, no git knowledge.
  Lives in `src/shared/` beside `validate.ts` / `governance.ts`. **Consumed only by the editor** — the
  skill never diffs (see below), so there is exactly one diff implementation and the two halves cannot
  drift.
- **The git layer:** lives only in the skill and is pure git **plumbing — no diffing**. It snapshots
  document versions from git (`git show <ref>:<path>`) into the cache and maintains the manifest; it
  does not compute diffs or attribution.
- **The cache:** a small, **committed, regenerable** set of files in `docs/specpad/` holding **raw
  snapshots** of past versions plus the manifest. The editor diffs these client-side; the filesystem
  stores only before/after states, **never computed diffs**.

### 2.1 The cache is a lockfile (the one principled exception)

The v1 contract says "nothing derived is stored." This feature introduces a deliberate, bounded
exception, governed by the **lockfile mental model**:

- Git remains the **single source of truth**. The cache is a *projection* of git, never authoritative.
- The cache is **fully regenerable** — the skill can rebuild every cached artifact from scratch from
  git at any time (`specpad refresh`).
- It is **committed, not gitignored** — it must travel with the repo because it is the only way the
  browser-based editor can see history.
- It is **machine-maintained** — humans don't hand-edit cache files (the manifest is the one
  exception; see §3).

This is exactly how a dependency lockfile is derived-yet-committed. The design states this exception
explicitly so it does not read as a regression of the v1 principle.

## 3. New artifacts in `docs/specpad/`

First-class, human-meaningful files (top level, alongside `*.proj/srs/vtp.json`):

### `<name>.releases.json` — the release register
Skill-maintained, **user-editable**. Records the detected tag pattern, which release the cached
baseline currently reflects, and the ordered list of releases. Powers the editor's **version-history
timeline** and the baseline selection.

```jsonc
{
  "schemaVersion": "1.0",
  "type": "releases",
  "name": "AcmeApp",
  "tagPattern": "v*",          // skill-detected; user may override
  "baseline": "v26.1",         // the release the cached baseline/ snapshot reflects
  "releases": [
    { "version": "v24.0", "ref": "v24.0", "date": "2025-11-02",
      "author": { "name": "Geoff Pollard", "email": "geoff@example.com" }, "snapshot": ".specpad/snapshots/v24.0" },
    { "version": "v26.0", "ref": "v26.0", "date": "2026-03-14",
      "author": { "name": "Sam Lee", "email": "sam@example.com" }, "snapshot": null },
    { "version": "v26.1", "ref": "v26.1", "date": "2026-05-30",
      "author": { "name": "Sam Lee", "email": "sam@example.com" }, "snapshot": ".specpad/baseline" }
  ]
}
```
`snapshot: null` means "listed in history but not yet cached" — pulled lazily on demand (see §4, #3).
`author` is the author of the tagged commit (**release granularity**). It is the source of the "by whom"
shown in attribution; the editor derives the *version* part of attribution by diffing snapshots, then
looks up that release's `author` here. There is **no per-item author cache**.

### `<name>.job.json` — the current-job marker
Skill-maintained and **editor-writable** (the user can set the active job from the UI). Labels
in-flight (uncommitted) redline edits and is folded into the commit's `Job:` trailer at commit time.

```jsonc
{ "schemaVersion": "1.0", "type": "job", "job": "PROJ-123", "title": "Add SSO login" }
```

### `.specpad/` — the machine-maintained cache (committed, NOT gitignored)
A hidden directory keeps cache clutter out of the main folder while still traveling with the repo.
**It must not be added to `.gitignore`** — it is the editor's bridge to git history. (Deliberately
**not** named `.cache/`, which many global gitignores exclude.)

```
docs/specpad/.specpad/
├── baseline/                       # raw snapshot of the spec at the latest release (ALWAYS present)
│   ├── <name>.proj.json
│   ├── <name>.srs.json
│   └── <name>.vtp.json
└── snapshots/<version>/            # older raw snapshots, lazily pulled on demand, then kept
    └── <name>.{proj,srs,vtp}.json
```

The cache holds **only raw snapshots** — verbatim copies of the spec files at past refs. There is **no
`attribution.json`** and no stored diff: the editor computes redline, release diff, arbitrary diff, and
version-level attribution from these snapshots client-side via `diffDocs`.

The two new file shapes (`releases`, `job`) get lightweight JSON Schemas + types in
`src/shared/schema.ts` so they are documented and validatable, but they are **sidecars** — the core
`proj/srs/vtp` schema is **unchanged**.

## 4. Responsibility split

The editor sees only the *working tree*. Therefore "working vs baseline" computes **everything
changed since the last release (#2)** — the headline always-on UI view, which visually contains the
in-flight redline. Distinguishing **uncommitted-only (#1, the precise redline)** requires `HEAD`,
which the browser cannot reach. So **#1-precise is a skill/git operation**, run at commit time as a
gate. That is its natural home anyway: it is a pre-commit check, not a passive view.

| # | Capability | Editor (diffs, in-UI, no git) | Skill (git plumbing only — never diffs) |
|---|---|---|---|
| 1 | Redline (uncommitted) | shows the union "since release" view via `diffDocs` | **name-level** pre-commit check that spec/test files are staged alongside code (not a semantic diff) |
| 2 | Since last release | **`working vs baseline`** via `diffDocs`, rendered as redline | snapshots the baseline; no diffing |
| 3 | Arbitrary version diff | diffs any two **cached** snapshots client-side via `diffDocs` | **pulls** the requested ref's snapshot into the cache on demand; no diffing |
| 4 | History / attribution | derives `added v24.0 · last changed v26.1` by diffing cached snapshots; shows the release `author` from the manifest | records per-release `author` in the manifest; commit-level "who" drill-down (`git log`) as an on-demand report |
| 5 | Jobs | sets `<name>.job.json`; (later) shows a job badge | `Job:` trailer at commit; **job → files/commits** traceability as an on-demand report (walks `git log`) |

## 5. The shared diff primitive

New module `src/shared/diff.ts`, exported from the barrel `src/shared/index.ts`:

```ts
export type ChangeStatus = 'added' | 'removed' | 'modified';

export interface ItemChange<T> {
  id: string;
  status: ChangeStatus;
  before?: T;            // absent for 'added'
  after?: T;             // absent for 'removed'
  changedFields?: string[]; // for 'modified': which fields differ (text, expected, verifies, ...)
}

export interface DocDiff<T> {
  added: ItemChange<T>[];
  removed: ItemChange<T>[];
  modified: ItemChange<T>[];
}

export function diffItems<T extends { id: string }>(oldItems: T[], newItems: T[]): DocDiff<T>;
export function diffDocs(oldDoc: SpecPadDoc, newDoc: SpecPadDoc): DocDiff<SrsItem | VtpItem>;
```

Properties:
- **Keyed on stable `id`**, never on `code` or array position — a renamed `code` or reordered list is
  not a spurious change. This is the whole reason the v1 contract mandates immutable ids.
- **Pure and deterministic** — no git, no clock, no I/O. Trivially unit-testable.
- `changedFields` enables precise UI highlighting (e.g. only the `expected` cell pulses). For array
  fields (`verifies`, `tags`, `hazards`) the granularity is **whole-field** — the field name appears
  in `changedFields` if the array differs at all; element-level array diffing is out of scope for v1.
- Heading items diff like any other item (by id).

## 6. The skill: git plumbing (the "magic")

The skill is **prose + git via Bash — no CLI, no diffing**. Its core operation, `refresh`, does all
behind-the-scenes prep:

1. Detect the tag pattern (default `v*`; respect a user override in `releases.json`).
2. Append any new matching tags to `releases.json` with their commit date **and `author`**
   (the author of the tagged commit).
3. Regenerate `.specpad/baseline/` from the newest release (`git show <ref>:<path>` for each doc).

There is **no attribution regeneration step** — the editor derives version-level attribution from the
snapshots, looking up the per-release `author` in the manifest. Because the redline is computed live in
the editor from `working vs baseline`, the only thing that ever needs refreshing is the slow-moving
baseline. `refresh` runs at release time or on demand; it is idempotent. Other skill operations:

- **pull `<version>`** (#3): `git show` the requested ref's spec files into
  `.specpad/snapshots/<version>/` and set its `snapshot` path in `releases.json`. No diffing.
- **pre-commit check** (#1): verify the spec/test files are staged when code changes — a **name-level**
  check (`git diff --cached --name-only`), not a semantic diff.
- **commit** (#5): write the `Job:` trailer from `<name>.job.json`, bundling code + spec + test + job.
- **on-demand reports** (#4/#5): job traceability ("which commits/files carry job X") and commit-level
  "who last changed item Y" are produced on request as **advisory prose** by walking `git log` /
  `git describe`. They are not cached and nothing depends on them, so they carry no drift risk against
  the editor's authoritative, snapshot-derived views.

**The skill never computes the cached diffs or attribution — that is exclusively the editor's job.**

## 7. Jobs: convention now, integration later

**Now:** jobs are a `Job: PROJ-123` **commit trailer**. The current-job marker labels in-flight work;
the skill writes the trailer at commit time and derives **job → SRS → VTP → source** by walking the
commits that carry a given job and running `diffDocs` on the spec deltas (the rest of each commit's
diff is the code).

**Later (documented extension point, not built in v1):** a `resolveJob(id) → {title, status, url}`
hook. The trailer convention is forward-compatible — a real tracker integration (Jira, Linear, GitHub
Issues) slots in behind `resolveJob` with zero rework to the storage or diff layers.

**Addendum (§13):** when there is **no external tracker**, SpecPad owns the job *records* itself in a
`<name>.jobs.json` register, and the `Job:` trailer carries the record's stable `id` (not a code).
See §13 for the register schema, the open/closed lifecycle, and the governance rules.

## 8. Editor UI

- **Redline rendering:** `SRSTable`/`VTPTable` mark rows added / modified / removed (with
  `changedFields` driving cell-level highlight), computed live from `working vs baseline`.
- **Version-history timeline:** a panel reading `releases.json`; selecting a cached version diffs it
  against the working tree or another cached version (all via `diffDocs`).
- **Inline attribution:** `added vX · last changed vY` **derived by diffing the cached snapshots**
  (which version first contains the id; which version last changed it); the "by whom" comes from that
  release's `author` in the manifest. Attribution is only as deep as the snapshots cached
  (latest + lazy): until older snapshots are pulled it reads "present at baseline".
- **Current-job control:** set/clear the active job, written to `<name>.job.json`.
- A **read-only / degraded** state when cache files are missing (repo never `refresh`ed) — the editor
  still opens and edits; it simply shows "history unavailable, run `specpad refresh`."

## 9. Error handling & edge cases

- **No cache yet:** editor degrades gracefully (§8); skill `refresh` creates it.
- **Cache stale vs working tree:** acceptable by design — the redline (live) is always fresh; only the
  baseline snapshot and attribution *depth* lag until the next `refresh`/`pull`. The editor may note
  staleness if the baseline ref is older than `HEAD`'s newest matching tag.
- **Shallow attribution:** with only latest + lazy snapshots, version attribution can resolve at best
  to the oldest cached snapshot; the editor shows "present at baseline" rather than guessing an
  earlier `addedIn`. Pulling older snapshots deepens it.
- **No tags in repo:** `releases.json` has an empty `releases[]`; redline still works against an
  empty/initial baseline; UI shows "no releases yet."
- **Renamed/moved spec files:** the manifest stores per-version `path` resolution; the skill follows
  git renames when snapshotting.
- **Cache accidentally gitignored:** documented loudly as a setup error; the skill warns if it detects
  `.specpad/` is ignored.
- **Item id reused/duplicated:** `diffItems` treats duplicate ids as a structural error surfaced via
  the existing `validate` path, not silently merged.

## 10. Testing

- **`diff.ts`:** unit tests — added/removed/modified detection, `changedFields` accuracy, id-keying
  (rename `code` ⇒ no change; reorder ⇒ no change), heading items, empty/`null` baselines. *(Done in
  Plan 1.)*
- **Shared contract:** `releases`/`job` schemas validate (incl. release `author`); invalid docs are
  rejected.
- **Skill:** `skill/__tests__/parity.test.ts` keeps the governance-rule-name guard; add a check that
  `SKILL.md` documents the cache layout and the plumbing operations. There is no skill-side diff to
  parity-test (the skill never diffs).
- **Editor (Plan 3):** redline highlight reflects a seeded `working vs baseline` delta; **attribution
  derivation** from a fixture set of snapshots + manifest resolves the right `addedIn`/`lastChangedIn`
  and author; timeline renders from a fixture `releases.json`; degraded state when cache absent.
- **Dogfood:** SpecPad's own `docs/specpad/` gains the new sidecars and stays valid/clean under
  `dogfood.test.ts`.

## 11. Explicitly deferred (YAGNI / non-goals)

- Eager snapshots of **all** releases (we cache latest + lazy-pull older).
- Always-fresh **per-commit** history in the UI (release granularity in UI; commit-level on demand).
- **Per-item author** attribution. We use per-release `author` (the author of the tagged commit); true
  "who edited this specific requirement" is an on-demand skill report, never cached.
- Live tracker (Jira) **API integration** — only the `resolveJob` extension point is designed, not
  built.
- Any change-tracking **fields back on spec items** — the spec schema stays unchanged.
- A backend / server — everything remains static editor + skill + git.

## 12. Resolved implementation decisions

1. **`changedFields` granularity for array fields** (`verifies`, `tags`, `hazards`): **whole-field** —
   the field is flagged changed if the array differs at all; no element-level array diffing in v1.
2. **Author attribution is per-release.** Each manifest release entry carries `author: {name, email}`
   (the author of the tagged commit). There is **no per-item author cache**; the editor pairs the
   snapshot-derived version with that release's author. Per-item/commit-level author is an on-demand
   skill report.
3. **Snapshot layout for multi-doc / custom file names:** **mirror the top-level file names** under
   each snapshot directory (`.specpad/baseline/<name>.srs.json`, etc.) rather than flattening.
4. **Diffing lives only in the editor.** The filesystem stores **raw before/after snapshots**, never
   computed diffs; the editor computes redline, release diff, arbitrary diff, and version attribution
   client-side via `diffDocs`. The skill never diffs.
5. **The skill is prose + git, with no CLI.** Its git layer is plumbing only (snapshot, manifest,
   trailers, on-demand reports), so there is no skill-side diff implementation that could drift from
   the editor's.
6. **`attribution.json` is removed** from the design. The `attribution` sidecar type/schema introduced
   in Plan 1 is dropped from the shared contract; `ReleaseEntry` gains `author`.

## 13. Jobs register (addendum)

**Date:** 2026-06-16 · **Status:** Design draft — extends §7 ("Jobs: convention now, integration later").

§7 covered the case where jobs live in an external tracker (the trailer is just a key, `resolveJob`
fills in the rest). This section covers the **no-tracker** case: the user defines jobs *inside* SpecPad
while working with Claude, and SpecPad owns the job records. It changes nothing about the diff
primitive, the cache, or the spec schema — it is one new sidecar plus two policy rules.

### 13.1 The stored-vs-derived split (the load-bearing decision)

A job has two kinds of information, and they live in two different places:

- **The record** — `title`, `description`, `status`. There is nowhere else for this to live (no
  tracker), so SpecPad stores it, authoritatively, in the register. This is descriptive metadata, not
  history — the same category as `VtpItem.result`.
- **The associations** — which SRS/VTP items the job touched, and across which commits/pushes. These
  are **never stored.** They are derived from git by walking the commits that carry the job's `Job:`
  trailer and running `diffDocs` on the spec deltas — identical to §7.

So the register holds **records only, never associations**. That is the line that keeps "git owns
history / nothing derived is stored" intact while still letting a job have a human title and a status.
There is **no `jobId` field on SRS/VTP items** (that would be change-tracking-as-data; see §11).

### 13.2 `<name>.jobs.json` — the job register

New sidecar, sibling of `releases.json` and `job.json`. Skill-maintained and editor-writable.

```jsonc
{
  "schemaVersion": "1.0",
  "type": "jobs",
  "name": "AcmeApp",
  "jobs": [
    { "id": "j_a1b2c3",        // stable, immutable — the Job: trailer and all references target this
      "code": "JOB-1",         // human label, freely renameable (SRS/VTP pattern); never referenced
      "title": "Add jobs list",
      "description": "Maintain a jobs register inside the SpecPad hierarchy.",
      "status": "open" }       // 'open' | 'closed' — current state, like VtpItem.result
  ]
}
```

`<name>.job.json` (§3) keeps its role unchanged: it points at the **active** job's `id`. It is the
"which record is current" cursor *into* this register; the register is the set of records. Setting a
job active = writing its `id` into `job.json`.

Proposed contract additions (sidecar only — core `proj/srs/vtp` schema untouched):

```ts
export type SidecarType = 'releases' | 'job' | 'jobs';

export interface JobRecord {
  id: string;            // stable, immutable
  code?: string;         // human label, renameable
  title: string;
  description?: string;
  status: 'open' | 'closed';
}

export interface JobsDoc {
  schemaVersion: SchemaVersion;
  type: 'jobs';
  name: string;
  jobs: JobRecord[];
}
// jobsSchema: $id 'specpad/v1/jobs' — STRUCTURE ONLY (required: schemaVersion, type, name, jobs;
// each job requires id, title, status; status enum ['open','closed']). Lifecycle policy is governance.
```

### 13.3 The `Job:` trailer carries `id`, not `code`

Contract invariant: references target the immutable `id`, never the renameable `code`, so renames
can't break links. A trailer reading `Job: JOB-1` is prettier in `git log`, but renaming `JOB-1` in the
register would orphan every past commit from the job. Therefore:

> **Decision.** The `Job:` trailer carries the stable `id` (e.g. `Job: j_a1b2c3`). Reports and the
> editor render it as the current `code`/`title` by lookup. For human readability the skill *may* write
> `Job: JOB-1 (j_a1b2c3)`, but the parse target is always the `id`.

This refines §7's illustrative `Job: PROJ-123` (an external key) for the SpecPad-owned case.

### 13.4 Lifecycle — open vs closed

`status` maps exactly onto "will any *future* commit carry this job's trailer?"

- **`open`** — the job can be activated; new commits may carry its trailer; its derived change-set and
  commit timeline keep growing.
- **`closed`** — scope is sealed. No future commit may reference it, so its change-set is frozen *by
  git history itself*. Further work spawns a **new** record.

The history of a status flip (open→closed) is just the git history of the `jobs.json` file — no status
changelog field.

### 13.5 Walkthrough — create, accrue, view, export

1. **Create:** skill appends `JOB-1` (`status: open`) to `jobs.json`, writes its `id` into `job.json`.
2. **Define the feature:** skill edits SRS/VTP normally; spec items gain no job field.
3. **Commit(s):** the §4 pre-commit gate stages spec/test edits with the code; each commit carries
   `Job: j_a1b2c3`. **Many commits/pushes over days all carry the same trailer** → multiple commits per
   job for free.
4. **View "everything for JOB-1":** skill walks `git log` for the trailer → commit timeline (hash,
   date, author, message, push refs); editor runs `diffDocs` across the job's start→HEAD snapshots →
   added/modified/removed SRS & VTP items. Record + timeline + semantic diff, all reconstructed.
5. **Release notes:** compose with `releases.json` — the jobs that landed in `v26.0→v26.1` are the
   distinct `Job:` trailers in that commit range; emit each record's title/description + its derived
   spec changes. Pure projection of (releases × records × diffs).

### 13.6 Walkthrough — modifying a job

- **Job still `open`:** set it active again, edit SRS/VTP, commit. The commit carries the same trailer —
  just one more commit on the same job; its change-set grows. Editing the record's own title/description
  is an edit to the `jobs.json` entry + a commit.
- **Job `closed`:** the skill refuses to re-activate it and offers to create `JOB-2` (new `id`,
  `status: open`) scoped to only the new work. New commits carry `Job: j_<new>`; `JOB-1` stays sealed.

### 13.7 Governance rules (two — placed by what they can see)

The two rules live in different layers because of the §4 editor-vs-skill visibility split:

1. **`active-job-open`** — pure data check: `job.json`'s active `id` must not resolve to a
   `jobs.json` record whose `status` is `closed`. Both files are in the working tree, so this is a
   real `checkGovernance` rule — runs in **both** the editor (`ValidationPanel`) and the skill, and is
   covered by `skill/__tests__/parity.test.ts`.
2. **`active-job-required-for-spec-changes`** — when spec/test files differ from `HEAD`, `job.json`
   must name an open job. This needs `HEAD`, which the browser can't see, so it is **not** a
   `checkGovernance` rule — it extends the existing skill **pre-commit gate** (§4 #1) and must *not* be
   added to `GOVERNANCE_RULES` (doing so would break parity, since the editor can't evaluate it).

### 13.8 Testing / dogfood touchpoints

- **Shared contract:** `jobs` schema validates; missing `status`/`title` rejected; `status` enum
  enforced.
- **Governance:** `active-job-open` fires when `job.json` points at a closed record, clean
  otherwise; parity test sees the new rule name on both sides.
- **Skill:** pre-commit gate blocks a spec change with no active open job; `SKILL.md` documents the
  register, the `id`-trailer rule, and the closed→new-job behavior.
- **Dogfood:** SpecPad's own `docs/specpad/` gains `<name>.jobs.json` and stays valid/clean under
  `dogfood.test.ts`.

### 13.9 Deferred (adds to §11)

- A `resolveJob`-style **two-way sync** with an external tracker. The register is authoritative *only*
  when there is no tracker; reconciling owned records against a live Jira/Linear is out of scope here.
- Job **dependencies / parent-child / ordering** — the register is a flat list in v1.
- Per-job **status beyond open/closed** (in-review, blocked, …) — two states cover the lifecycle rule.

## 14. Multi-job support & git-workflow assumption audit

**Date:** 2026-06-16 · extends §13.

### 14.1 Multi-job marker
A commit may belong to several jobs. The marker `<name>.job.json` holds `jobs: string[]` (record ids,
or tracker keys with no register); the legacy single `job: string` is still read. All readers go
through `activeJobIds(marker)` → `marker.jobs ?? (marker.job ? [marker.job] : [])`. The skill writes
**one `Job:` trailer per active id**; the editor offers a **checkbox multi-select** of open records.
The trace report and release notes already group by distinct trailer id, so a commit naturally appears
under each of its jobs.

### 14.2 Dummy-proofing the data (governance + editor)
Two pure-data rules, evaluated by **both** the editor and the skill (parity-tested):
- `active-job-open` — no active entry points at a `closed` record.
- `active-job-known` — when a register exists, every active entry resolves to a record (catches
  dangling/mistyped ids). With no register, entries are external keys and neither rule applies.

The editor never *offers* a closed job for activation, lets a hand-edited closed-but-active job be
removed from the active set (self-heal), and continues new `code`s from the highest `JOB-N` so
deleting/reordering can't collide.

### 14.3 Works with any git workflow — the assumption audit
The traceability spine is the **commit trailer**, which travels through branch / merge / rebase / fork
/ cherry-pick. Nothing authoritative depends on branch topology — the report just walks `git log`.

| Workflow | Result |
|---|---|
| Trunk-based / commit-to-main | ✓ |
| Feature branch + merge commit | ✓ original commits + trailers retained |
| Rebase-and-merge | ✓ commits replayed, trailers preserved |
| Forking / PR from a fork | ✓ trailers travel with the commits |
| No release tags (continuous deploy) | ✓ jobs are independent of releases; baseline / release-notes degrade gracefully |
| Worktrees / monorepo | ✓ marker is per-project-name and per-branch (it is a committed file) |

**Soft spots — degrade, never break:**
1. **Squash merge** collapses N commits → 1; the job association survives only if the `Job:` trailer
   lands in the squash message (granularity drops to the squash commit). Mitigation is a PR-template /
   squash convention — never enforced.
2. **The active-job marker is a convenience cursor, not truth.** Committing it makes the active job
   per-branch (handles parallel branches); a team may keep it local instead. Either way traceability
   is unaffected, because the durable link is the trailer.
3. **The pre-commit gate is advisory** (skill behavior), not a forced hook. Teams wanting hard
   enforcement add a real `commit-msg` / `pre-commit` hook; SpecPad does not impose one.

**Residual assumptions — documented and accepted:**
- Spec files live in the **same repo** as code (the "spec rides with code" gate can't reach a separate
  spec repo).
- Records are **closed, not deleted** — deleting a record that past commits reference orphans the
  trailer (still traceable by id, just without a title); the editor offers close, not delete.
- `<name>.job.json` (marker) vs `<name>.jobs.json` (register) differ by one letter — humans never type
  them; the editor and skill own both files.
