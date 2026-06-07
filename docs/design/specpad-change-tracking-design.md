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
`author` is the release's tagger/committer (**release granularity**). It is the source of the "by whom"
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
   (the tag's tagger, or the tagged commit's committer).
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
- **Per-item author** attribution. We use per-release `author` (the release's tagger/committer); true
  "who edited this specific requirement" is an on-demand skill report, never cached.
- Live tracker (Jira) **API integration** — only the `resolveJob` extension point is designed, not
  built.
- Any change-tracking **fields back on spec items** — the spec schema stays unchanged.
- A backend / server — everything remains static editor + skill + git.

## 12. Resolved implementation decisions

1. **`changedFields` granularity for array fields** (`verifies`, `tags`, `hazards`): **whole-field** —
   the field is flagged changed if the array differs at all; no element-level array diffing in v1.
2. **Author attribution is per-release.** Each manifest release entry carries `author: {name, email}`
   (the release's tagger/committer). There is **no per-item author cache**; the editor pairs the
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
