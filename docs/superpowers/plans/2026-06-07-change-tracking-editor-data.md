# Change Tracking — Plan 3a: Editor Data & Logic Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the editor the pure logic and the file-transport it needs to render change tracking — a `changeTracking.ts` module that turns cached snapshots + the working doc into a redline and version-level attribution, plus `localFileApi.ts` loaders for the cache files (`<name>.releases.json`, `<name>.job.json`, and `.specpad/` snapshots).

**Architecture:** Per the revised design, the editor owns all diffing and reads raw snapshots the skill wrote. This plan builds the seam between disk and UI, with NO React/UI changes (that's Plan 3b). The logic is a pure module over the shared `diffDocs`/`diffItems` (so attribution is derived, never stored); the transport is thin File System Access wrappers that return `null` when the cache is absent (the degraded state Plan 3b will render).

**Tech Stack:** TypeScript, React app's shared module (`src/shared`), Vitest. No new dependencies.

**Source design:** `docs/design/specpad-change-tracking-design.md` — §3 (cache files + per-release `author`), §4/§8 (editor derives redline + attribution), §9 (shallow attribution / degraded state).

---

## File Structure

- **Create** `src/changeTracking.ts` — pure editor-side logic: `buildRedline(baseline, working)` and `computeAttribution(snapshots)`, over the shared `diffDocs`/`diffItems`. No I/O, no React.
- **Create** `src/__tests__/changeTracking.test.ts` — unit tests for both functions.
- **Modify** `src/localFileApi.ts` — add `snapshotDirSegments` (pure), a `.specpad` subdir navigator, and loaders `loadReleases` / `loadJob` / `saveJob` / `loadSnapshot`. The File System Access calls follow the existing thin-wrapper style (only the pure helper is unit-tested, matching the current module).
- **Modify** `src/__tests__/localFileApi.test.ts` — add a `snapshotDirSegments` test.

**Conventions to match:** `src/shared` is imported via the `./shared` barrel; loaders return `null` (not throw) when a file/dir is missing (`NotFoundError`), so callers can degrade. Tests use Vitest `describe/it/expect` with inline fixtures (see `localFileApi.test.ts`).

---

## Task 1: `changeTracking.ts` — pure redline + attribution

**Files:**
- Create: `src/changeTracking.ts`
- Test: `src/__tests__/changeTracking.test.ts`

- [ ] **Step 1: Write the failing test — create `src/__tests__/changeTracking.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildRedline, computeAttribution } from '../changeTracking';
import type { SrsDoc, SrsItem, AuthorRef } from '../shared';

function srs(items: SrsItem[]): SrsDoc {
  return { schemaVersion: '1.0', type: 'srs', name: 'AcmeApp', title: 'Reqs', items };
}
const geoff: AuthorRef = { name: 'Geoff', email: 'g@x.com' };
const sam: AuthorRef = { name: 'Sam', email: 's@x.com' };

describe('buildRedline', () => {
  const baseItems: SrsItem[] = [
    { id: 'r_1', text: 'A' },
    { id: 'r_2', text: 'B' },
  ];

  it('returns an empty redline when there is no baseline', () => {
    const r = buildRedline(null, srs(baseItems));
    expect(r.byId.size).toBe(0);
    expect(r.removed).toEqual([]);
  });

  it('marks added, modified (with changedFields), and removed vs the baseline', () => {
    const working = srs([
      { id: 'r_1', text: 'A2' }, // modified
      { id: 'r_3', text: 'C' }, // added
    ]); // r_2 removed
    const r = buildRedline(srs(baseItems), working);
    expect(r.byId.get('r_3')).toEqual({ status: 'added' });
    expect(r.byId.get('r_1')).toEqual({ status: 'modified', changedFields: ['text'] });
    expect(r.byId.has('r_2')).toBe(false);
    expect(r.removed.map((c) => c.id)).toEqual(['r_2']);
  });
});

describe('computeAttribution', () => {
  it('returns an empty map for no snapshots', () => {
    expect(computeAttribution([]).size).toBe(0);
  });

  it('attributes everything in a single snapshot to that release, as a boundary', () => {
    const m = computeAttribution([
      { version: 'v1.0', author: geoff, doc: srs([{ id: 'r_1', text: 'A' }]) },
    ]);
    expect(m.get('r_1')).toEqual({
      addedIn: 'v1.0',
      addedBoundary: true,
      lastChangedIn: 'v1.0',
      author: geoff,
    });
  });

  it('tracks add, modify, and unchanged across two snapshots', () => {
    const m = computeAttribution([
      { version: 'v1.0', author: geoff, doc: srs([{ id: 'r_1', text: 'A' }, { id: 'r_2', text: 'B' }]) },
      { version: 'v2.0', author: sam, doc: srs([{ id: 'r_1', text: 'A2' }, { id: 'r_2', text: 'B' }, { id: 'r_3', text: 'C' }]) },
    ]);
    // r_1 modified in v2.0 → addedIn stays v1.0 (boundary), lastChangedIn/author bump to v2.0/sam
    expect(m.get('r_1')).toEqual({ addedIn: 'v1.0', addedBoundary: true, lastChangedIn: 'v2.0', author: sam });
    // r_2 unchanged → stays at v1.0/geoff
    expect(m.get('r_2')).toEqual({ addedIn: 'v1.0', addedBoundary: true, lastChangedIn: 'v1.0', author: geoff });
    // r_3 added in v2.0 → not a boundary
    expect(m.get('r_3')).toEqual({ addedIn: 'v2.0', addedBoundary: false, lastChangedIn: 'v2.0', author: sam });
  });

  it('drops an item removed in a later snapshot', () => {
    const m = computeAttribution([
      { version: 'v1.0', author: geoff, doc: srs([{ id: 'r_1', text: 'A' }]) },
      { version: 'v2.0', author: sam, doc: srs([]) },
    ]);
    expect(m.has('r_1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/changeTracking.test.ts`
Expected: FAIL — cannot resolve import `../changeTracking`.

- [ ] **Step 3: Implement — create `src/changeTracking.ts`**

```ts
/**
 * changeTracking — pure editor-side derivation of redline + attribution.
 * No I/O, no React. Built on the shared diff primitive so the editor's view of
 * "what changed" is identical to the contract's. Attribution is DERIVED from the
 * raw snapshots the skill cached — never stored (see specpad-change-tracking-design.md).
 */
import type { SrsDoc, VtpDoc, SrsItem, VtpItem, AuthorRef } from './shared';
import { diffDocs, diffItems } from './shared';
import type { ItemChange } from './shared';

type AnyDoc = SrsDoc | VtpDoc;
type AnyItem = SrsItem | VtpItem;

export interface RedlineEntry {
  status: 'added' | 'modified';
  changedFields?: string[];
}

export interface RedlineView {
  /** Working-doc items that are new or changed vs the baseline, keyed by id. */
  byId: Map<string, RedlineEntry>;
  /** Items present in the baseline but absent from the working doc. */
  removed: ItemChange<AnyItem>[];
}

/** Diff the working doc against a baseline snapshot (the latest release). */
export function buildRedline(baseline: AnyDoc | null, working: AnyDoc): RedlineView {
  const byId = new Map<string, RedlineEntry>();
  if (!baseline) return { byId, removed: [] };
  const diff = diffDocs(baseline, working);
  for (const c of diff.added) byId.set(c.id, { status: 'added' });
  for (const c of diff.modified) {
    byId.set(c.id, { status: 'modified', changedFields: c.changedFields });
  }
  return { byId, removed: diff.removed };
}

export interface SnapshotInput {
  version: string;
  author: AuthorRef;
  doc: AnyDoc;
}

export interface AttributionView {
  addedIn: string;
  /** True when addedIn is the OLDEST cached snapshot — the item may be older still. */
  addedBoundary: boolean;
  lastChangedIn: string;
  /** Author of the lastChangedIn release. */
  author: AuthorRef;
}

/**
 * Derive per-item attribution from cached snapshots, ordered OLDEST → NEWEST.
 * Everything in the oldest snapshot is a "boundary" add (could predate the cache).
 * Each later snapshot's adds/modifies advance the record; removals drop it.
 */
export function computeAttribution(snapshots: SnapshotInput[]): Map<string, AttributionView> {
  const out = new Map<string, AttributionView>();
  if (snapshots.length === 0) return out;

  const [first, ...rest] = snapshots;
  for (const item of first.doc.items) {
    out.set(item.id, {
      addedIn: first.version,
      addedBoundary: true,
      lastChangedIn: first.version,
      author: first.author,
    });
  }

  let prev = first;
  for (const snap of rest) {
    const diff = diffItems(prev.doc.items, snap.doc.items);
    for (const c of diff.added) {
      out.set(c.id, {
        addedIn: snap.version,
        addedBoundary: false,
        lastChangedIn: snap.version,
        author: snap.author,
      });
    }
    for (const c of diff.modified) {
      const cur = out.get(c.id);
      if (cur) {
        cur.lastChangedIn = snap.version;
        cur.author = snap.author;
      } else {
        out.set(c.id, {
          addedIn: snap.version,
          addedBoundary: false,
          lastChangedIn: snap.version,
          author: snap.author,
        });
      }
    }
    for (const c of diff.removed) out.delete(c.id);
    prev = snap;
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/changeTracking.test.ts`
Expected: PASS, all tests (2 redline + 4 attribution).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` — no errors.
Run: `npm run lint` — no errors.

- [ ] **Step 6: Commit**

```bash
git add src/changeTracking.ts src/__tests__/changeTracking.test.ts
git commit -m "feat(editor): pure redline + attribution derivation over the shared diff

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `localFileApi.ts` — cache-file loaders

**Files:**
- Modify: `src/localFileApi.ts`
- Test: `src/__tests__/localFileApi.test.ts`

- [ ] **Step 1: Add the failing test to `src/__tests__/localFileApi.test.ts`**

Add this import at the top (extend the existing import from `../localFileApi`):

```ts
import { parseDocument, serializeDocument, snapshotDirSegments } from '../localFileApi';
```

And append this describe block to the file:

```ts
describe('snapshotDirSegments', () => {
  it('points "baseline" at .specpad/baseline', () => {
    expect(snapshotDirSegments('baseline')).toEqual(['.specpad', 'baseline']);
  });

  it('points a version at .specpad/snapshots/<version>', () => {
    expect(snapshotDirSegments({ version: 'v26.1' })).toEqual(['.specpad', 'snapshots', 'v26.1']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/localFileApi.test.ts`
Expected: FAIL — `snapshotDirSegments` is not exported.

- [ ] **Step 3: Implement the additions in `src/localFileApi.ts`**

First, extend the type import at the top of the file (it currently imports `ProjectDoc, SrsDoc, VtpDoc, SpecPadDoc`):

```ts
import type { ProjectDoc, SrsDoc, VtpDoc, SpecPadDoc, ReleasesDoc, JobDoc } from './shared';
```

Then append the following at the END of `src/localFileApi.ts`:

```ts
// ---- Change-tracking cache loaders (manifest, job marker, snapshots) ----
// All return null when the file/dir is absent so the editor can show a degraded
// (no-history) state instead of erroring. The skill writes these; we only read
// (and write the job marker the user sets).

export type SnapshotLocation = 'baseline' | { version: string };

/** Pure: the .specpad path segments for a snapshot location. */
export function snapshotDirSegments(location: SnapshotLocation): string[] {
  return location === 'baseline'
    ? ['.specpad', 'baseline']
    : ['.specpad', 'snapshots', location.version];
}

/** Walk into a nested subdirectory of the open project; null if any segment is missing. */
async function getSubDirectory(segments: string[]): Promise<FileSystemDirectoryHandle | null> {
  if (!projectDirHandle) return null;
  let dir: any = projectDirHandle;
  for (const seg of segments) {
    try {
      dir = await dir.getDirectoryHandle(seg);
    } catch {
      return null;
    }
  }
  return dir as FileSystemDirectoryHandle;
}

async function readJsonFrom(
  dir: FileSystemDirectoryHandle,
  filename: string,
): Promise<SpecPadDoc | null> {
  try {
    const fh = await dir.getFileHandle(filename);
    return parseDocument(await (await fh.getFile()).text());
  } catch {
    return null;
  }
}

/** Load the release manifest `<name>.releases.json`, or null if absent. */
export async function loadReleases(name: string): Promise<ReleasesDoc | null> {
  if (!projectDirHandle) return null;
  return (await readJsonFrom(projectDirHandle, `${name}.releases.json`)) as ReleasesDoc | null;
}

/** Load the current-job marker `<name>.job.json`, or null if absent. */
export async function loadJob(name: string): Promise<JobDoc | null> {
  if (!projectDirHandle) return null;
  return (await readJsonFrom(projectDirHandle, `${name}.job.json`)) as JobDoc | null;
}

/** Write the current-job marker `<name>.job.json`. */
export async function saveJob(name: string, doc: JobDoc): Promise<void> {
  if (!projectDirHandle) throw new Error('No directory selected');
  const fileHandle = await projectDirHandle.getFileHandle(`${name}.job.json`, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(serializeDocument(doc));
    await writable.close();
  } catch (err) {
    await writable.abort();
    throw err;
  }
}

/** Load a cached snapshot doc (`.specpad/baseline/...` or `.specpad/snapshots/<version>/...`). */
export async function loadSnapshot(
  location: SnapshotLocation,
  type: 'srs' | 'vtp' | 'proj',
  name: string,
): Promise<SpecPadDoc | null> {
  const dir = await getSubDirectory(snapshotDirSegments(location));
  if (!dir) return null;
  return readJsonFrom(dir, `${name}.${type}.json`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/localFileApi.test.ts`
Expected: PASS — the original 2 tests plus the 2 new `snapshotDirSegments` tests.

- [ ] **Step 5: Full suite, typecheck, lint**

Run: `npm test` — all green.
Run: `npx tsc --noEmit` — no errors.
Run: `npm run lint` — no errors.

- [ ] **Step 6: Commit**

```bash
git add src/localFileApi.ts src/__tests__/localFileApi.test.ts
git commit -m "feat(editor): load change-tracking cache files (manifest, job, snapshots)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (against revised design §3/§4/§8/§9):**
- §8 redline = `working vs baseline` via `diffDocs` → `buildRedline` (Task 1). ✓
- §8 version attribution derived by diffing cached snapshots, author from the release → `computeAttribution` (Task 1), `addedBoundary` models §9 "present at baseline" shallowness. ✓
- §3 cache files (`<name>.releases.json`, `<name>.job.json`, `.specpad/baseline`, `.specpad/snapshots/<version>`) → `loadReleases`/`loadJob`/`saveJob`/`loadSnapshot` + `snapshotDirSegments` (Task 2). ✓
- §9 degraded state — loaders return `null` when absent so Plan 3b can render the no-history state. ✓
- §3 mirrored snapshot file names (`<name>.<type>.json` under each snapshot dir) → `loadSnapshot` builds exactly that path. ✓

**2. Placeholder scan:** No TBD/TODO. Every code step has complete code; every test step real assertions; every run step exact command + expected result.

**3. Type/name consistency:** `buildRedline`/`computeAttribution`, `RedlineView`/`RedlineEntry`/`SnapshotInput`/`AttributionView`, and `snapshotDirSegments`/`loadReleases`/`loadJob`/`saveJob`/`loadSnapshot`/`SnapshotLocation` are used identically across `changeTracking.ts`, `localFileApi.ts`, and both test files. `ReleasesDoc`/`JobDoc`/`AuthorRef`/`ItemChange` come from the `./shared` barrel (defined in Plans 1–2). `loadSnapshot` returns `SpecPadDoc | null`; callers in Plan 3b narrow by the `type` they requested.

---

## Out of scope (Plan 3b — editor UI)

Wiring these loaders into `LocalApp` state; passing the redline + attribution into `SRSTable`/`VTPTable` (row/cell highlight, removed-items panel, inline `added vX · last changed vY · author`); the version-history timeline panel and choosing the comparison baseline; the current-job control (using `saveJob`); the degraded "history unavailable — run `specpad refresh`" state; and CSS in `specpad.less`. All consume the API finalized here.
