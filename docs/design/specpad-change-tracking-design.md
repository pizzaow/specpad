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
  Lives in `src/shared/` beside `validate.ts` / `governance.ts`; imported by **both** the editor and
  the skill, so the two layers can never drift (same pattern as the existing shared contract).
- **The git layer:** lives only in the skill. It fetches document versions from git
  (`git show <ref>:<path>`), walks commits for attribution, and reads/writes the cache.
- **The cache:** a small, **committed, regenerable** set of sidecar files in `docs/specpad/` that
  bridges the editor to git history.

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
    { "version": "v24.0", "ref": "v24.0", "date": "2025-11-02", "snapshot": ".specpad/snapshots/v24.0" },
    { "version": "v26.0", "ref": "v26.0", "date": "2026-03-14", "snapshot": null },
    { "version": "v26.1", "ref": "v26.1", "date": "2026-05-30", "snapshot": ".specpad/baseline" }
  ]
}
```
`snapshot: null` means "listed in history but not yet cached" — pulled lazily on demand (see §4, #3).

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
├── baseline/                       # snapshot of the spec at the latest release (ALWAYS present)
│   ├── <name>.proj.json
│   ├── <name>.srs.json
│   └── <name>.vtp.json
├── snapshots/<version>/            # older snapshots, lazily pulled on demand, then kept
│   └── <name>.{proj,srs,vtp}.json
└── attribution.json                # per-item history at release granularity
```

```jsonc
// attribution.json
{
  "schemaVersion": "1.0",
  "type": "attribution",
  "items": {
    "r_7f3a9c": {
      "addedIn": "v24.0",
      "addedBy": { "name": "Geoff Pollard", "email": "geoffpollard@gmail.com" },
      "lastChangedIn": "v26.1",
      "lastChangedBy": { "name": "Sam Lee", "email": "sam@example.com" }
    }
  }
}
```

The three new file shapes (`releases`, `job`, `attribution`) get lightweight JSON Schemas + types in
`src/shared/schema.ts` so they are documented and validatable, but they are **sidecars** — the core
`proj/srs/vtp` schema is **unchanged**.

## 4. Responsibility split

The editor sees only the *working tree*. Therefore "working vs baseline" computes **everything
changed since the last release (#2)** — the headline always-on UI view, which visually contains the
in-flight redline. Distinguishing **uncommitted-only (#1, the precise redline)** requires `HEAD`,
which the browser cannot reach. So **#1-precise is a skill/git operation**, run at commit time as a
gate. That is its natural home anyway: it is a pre-commit check, not a passive view.

| # | Capability | Editor (live, in-UI, no git) | Skill (git-aware) |
|---|---|---|---|
| 1 | Redline (uncommitted) | shows the union "since release" view | **precise** `working vs HEAD`; pre-commit gate ensuring code + spec + test + job travel together |
| 2 | Since last release | **`working vs baseline`** via `diffDocs`, rendered as redline | can also emit a report |
| 3 | Arbitrary version diff | diff any two **cached** versions client-side | **pulls two refs** from git, diffs, writes a one-off report, caches the snapshot for next time |
| 4 | History / attribution | inline `added v24.0 · last changed v26.1` from `attribution.json` | regenerates `attribution.json`; commit-level drill-down (`git log`) on demand |
| 5 | Jobs | sets `<name>.job.json`; (later) shows a job badge | `Job:` trailer; derives **job → SRS → VTP → code**; commit helper |

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

## 6. The skill: the `refresh` operation (the "magic")

A single skill operation does all behind-the-scenes prep:

1. Detect the tag pattern (default `v*`; respect a user override in `releases.json`).
2. Append any new matching tags to `releases.json` with their commit dates.
3. Regenerate `.specpad/baseline/` from the newest release (`git show <ref>:<path>` for each doc).
4. Regenerate `.specpad/attribution.json` by diffing consecutive release snapshots (release
   granularity) — the **same pass** as the baseline refresh, so one refresh covers both #2 and #4.

Because the redline is computed **live** in the editor from `working vs baseline`, the only thing
that ever needs refreshing is the slow-moving baseline. `refresh` runs at release time or on demand;
it is idempotent. Other skill operations:

- **redline** (#1): `git diff`-equivalent of `working vs HEAD`, parsed through `diffDocs`; the
  pre-commit gate that confirms spec/test edits accompany code edits.
- **diff `<refA> <refB>`** (#3): pull both via git, run `diffDocs`, write a report, cache the older
  snapshot and set its `snapshot` path in `releases.json`.
- **history `<id>`** (#4): commit-level drill-down via `git log`/`git describe` for one item.
- **commit** (#5): write the `Job:` trailer from `<name>.job.json`, ensuring the commit bundles
  code + spec + test + job.

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
  against the working tree or another cached version.
- **Inline attribution:** `added vX · last changed vY` shown per item from `attribution.json`.
- **Current-job control:** set/clear the active job, written to `<name>.job.json`.
- A **read-only / degraded** state when cache files are missing (repo never `refresh`ed) — the editor
  still opens and edits; it simply shows "history unavailable, run `specpad refresh`."

## 9. Error handling & edge cases

- **No cache yet:** editor degrades gracefully (§8); skill `refresh` creates it.
- **Cache stale vs working tree:** acceptable by design — the redline (live) is always fresh; only
  release-granularity attribution lags until the next `refresh`. The editor may note staleness if the
  baseline ref is older than `HEAD`'s newest matching tag.
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
  (rename `code` ⇒ no change; reorder ⇒ no change), heading items, empty/`null` baselines.
- **Skill parity:** extend `skill/__tests__/parity.test.ts` so the skill's diff/attribution behavior
  matches the shared module (same as the existing governance parity guard).
- **Cache regeneration:** golden test — build a fixture repo with tags, run `refresh`, assert
  `baseline/`, `attribution.json`, and `releases.json` match expected; rerun ⇒ idempotent.
- **Editor:** redline highlight reflects a seeded `working vs baseline` delta; timeline renders from a
  fixture `releases.json`; degraded state when cache absent.
- **Dogfood:** SpecPad's own `docs/specpad/` gains the new sidecars and stays valid/clean under
  `dogfood.test.ts`.

## 11. Explicitly deferred (YAGNI / non-goals)

- Eager snapshots of **all** releases (we cache latest + lazy-pull older).
- Always-fresh **per-commit** history in the UI (release granularity in UI; commit-level on demand).
- Live tracker (Jira) **API integration** — only the `resolveJob` extension point is designed, not
  built.
- Any change-tracking **fields back on spec items** — the spec schema stays unchanged.
- A backend / server — everything remains static editor + skill + git.

## 12. Resolved implementation decisions

1. **`changedFields` granularity for array fields** (`verifies`, `tags`, `hazards`): **whole-field** —
   the field is flagged changed if the array differs at all; no element-level array diffing in v1.
2. **`attribution.json` author identity:** record **both name and email** as `{name, email}`; the UI
   decides which to display.
3. **Snapshot layout for multi-doc / custom file names:** **mirror the top-level file names** under
   each snapshot directory (`.specpad/baseline/<name>.srs.json`, etc.) rather than flattening.
