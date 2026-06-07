# Change Tracking — Plan 3b: Editor UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface change tracking in the editor UI — redline highlighting + inline attribution in the SRS/VTP tables, a version-history timeline, a current-job control, and a graceful degraded state — all driven by the Plan 3a data layer.

**Architecture:** Plan 3a gave us pure logic (`buildRedline`, `computeAttribution`) and cache loaders (`loadReleases`/`loadJob`/`saveJob`/`loadSnapshot`). This plan consumes them: `LocalApp` loads the cache for the open project, computes the redline (working doc vs the latest-release baseline snapshot) and attribution (over the ordered cached snapshots, author from the manifest), and passes them into the tables. Pure presentation helpers keep the table components testable. When the cache is absent the loaders return `null` and the UI shows a "history unavailable" note while remaining fully editable.

**Tech Stack:** React 18 + TypeScript, Bootstrap 3 classes (existing), LESS, Vitest + Testing Library. No new dependencies.

**Source design:** `docs/design/specpad-change-tracking-design.md` — §4 (#1 redline is working-vs-baseline in UI), §8 (editor UI: redline, timeline, inline attribution, job control, degraded state), §9 (shallow attribution / degraded).

**Scope note:** Redline is always *working-doc vs the latest-release baseline*. Interactive "compare any two past versions" is **deferred** (the timeline is read-only context in this plan).

---

## File Structure

- **Create** `src/changeTrackingView.ts` — pure presentation helpers: `rowStatusClass`, `isCellChanged`, `attributionLabel`, `cachedReleases`. No React.
- **Create** `src/__tests__/changeTrackingView.test.ts`.
- **Modify** `src/components/SRSTable.tsx` / `src/components/VTPTable.tsx` — accept optional `redline` + `attribution` props; apply row/cell classes; add a History column and a "Removed since baseline" panel.
- **Modify** `src/components/__tests__/SRSTable.test.tsx` / `VTPTable.test.tsx` — assert redline/attribution rendering.
- **Create** `src/components/VersionTimeline.tsx` + `src/components/JobControl.tsx` — presentational; **Create** their tests.
- **Modify** `src/LocalApp.tsx` — load the cache, compute redline + attribution, render the new components, degraded note.
- **Modify** `src/__tests__/LocalApp.test.tsx` — extend the `localFileApi` mock with the new loaders.
- **Modify** `src/specpad.less` — classes for `warning` rows, changed cells, removed panel, timeline.

**Conventions:** Bootstrap 3 contextual row classes already used — `info` (heading), `danger` (bad ref), `success`. We add `warning` (modified). Tests use Testing Library; query rows via `container.querySelector('tr.success')` where text queries don't suffice.

---

## Task 1: Pure presentation helpers (`changeTrackingView.ts`)

**Files:**
- Create: `src/changeTrackingView.ts`
- Test: `src/__tests__/changeTrackingView.test.ts`

- [ ] **Step 1: Write the failing test — create `src/__tests__/changeTrackingView.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { rowStatusClass, isCellChanged, attributionLabel, cachedReleases } from '../changeTrackingView';
import type { AttributionView } from '../changeTracking';
import type { ReleasesDoc } from '../shared';

describe('rowStatusClass', () => {
  it('marks headings info regardless of redline', () => {
    expect(rowStatusClass(true, { status: 'modified', changedFields: ['text'] })).toBe('info');
  });
  it('maps added → success, modified → warning, none → empty', () => {
    expect(rowStatusClass(false, { status: 'added' })).toBe('success');
    expect(rowStatusClass(false, { status: 'modified' })).toBe('warning');
    expect(rowStatusClass(false, undefined)).toBe('');
  });
});

describe('isCellChanged', () => {
  it('is true only for a modified entry whose changedFields includes the field', () => {
    expect(isCellChanged({ status: 'modified', changedFields: ['text', 'tags'] }, 'text')).toBe(true);
    expect(isCellChanged({ status: 'modified', changedFields: ['tags'] }, 'text')).toBe(false);
    expect(isCellChanged({ status: 'added' }, 'text')).toBe(false);
    expect(isCellChanged(undefined, 'text')).toBe(false);
  });
});

describe('attributionLabel', () => {
  const sam = { name: 'Sam', email: 's@x.com' };
  it('returns "new" when there is no attribution', () => {
    expect(attributionLabel(undefined)).toBe('new');
  });
  it('shows a boundary add with author when added==lastChanged', () => {
    const a: AttributionView = { addedIn: 'v1.0', addedBoundary: true, lastChangedIn: 'v1.0', author: sam };
    expect(attributionLabel(a)).toBe('≤v1.0 · Sam');
  });
  it('shows added and changed separately when they differ', () => {
    const a: AttributionView = { addedIn: 'v1.0', addedBoundary: false, lastChangedIn: 'v2.0', author: sam };
    expect(attributionLabel(a)).toBe('added v1.0 · changed v2.0 · Sam');
  });
});

describe('cachedReleases', () => {
  const sam = { name: 'Sam', email: 's@x.com' };
  const releases: ReleasesDoc = {
    schemaVersion: '1.0', type: 'releases', name: 'AcmeApp', tagPattern: 'v*', baseline: 'v2.0',
    releases: [
      { version: 'v1.0', ref: 'v1.0', date: '2025-01-01', author: sam, snapshot: '.specpad/snapshots/v1.0' },
      { version: 'v1.5', ref: 'v1.5', date: '2025-06-01', author: sam, snapshot: null },
      { version: 'v2.0', ref: 'v2.0', date: '2026-01-01', author: sam, snapshot: '.specpad/baseline' },
    ],
  };
  it('returns null releases as an empty list', () => {
    expect(cachedReleases(null)).toEqual([]);
  });
  it('keeps only cached releases, mapping the baseline version to the baseline location', () => {
    expect(cachedReleases(releases)).toEqual([
      { version: 'v1.0', author: sam, location: { version: 'v1.0' } },
      { version: 'v2.0', author: sam, location: 'baseline' },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/changeTrackingView.test.ts`
Expected: FAIL — cannot resolve `../changeTrackingView`.

- [ ] **Step 3: Implement — create `src/changeTrackingView.ts`**

```ts
/**
 * changeTrackingView — pure presentation helpers for the editor's change-tracking UI.
 * No React. Map the Plan-3a derivations (RedlineEntry / AttributionView) and the
 * manifest into display strings, CSS classes, and a snapshot-load order.
 */
import type { RedlineEntry, AttributionView, SnapshotInput } from './changeTracking';
import type { ReleasesDoc } from './shared';
import type { SnapshotLocation } from './localFileApi';

/** Bootstrap contextual row class for a redline status (heading always wins). */
export function rowStatusClass(heading: boolean | undefined, rl: RedlineEntry | undefined): string {
  if (heading) return 'info';
  if (rl?.status === 'added') return 'success';
  if (rl?.status === 'modified') return 'warning';
  return '';
}

/** Whether a given field's cell should be flagged as changed. */
export function isCellChanged(rl: RedlineEntry | undefined, field: string): boolean {
  return rl?.status === 'modified' && (rl.changedFields?.includes(field) ?? false);
}

/** Compact attribution label. Boundary adds show "≤v"; undefined → "new". */
export function attributionLabel(a: AttributionView | undefined): string {
  if (!a) return 'new';
  const added = a.addedBoundary ? `≤${a.addedIn}` : a.addedIn;
  const who = a.author?.name ?? '';
  if (a.lastChangedIn === a.addedIn) {
    return who ? `${added} · ${who}` : added;
  }
  return who
    ? `added ${added} · changed ${a.lastChangedIn} · ${who}`
    : `added ${added} · changed ${a.lastChangedIn}`;
}

/** A cached release ready to load: version, author, and its snapshot location. */
export interface CachedRelease {
  version: string;
  author: SnapshotInput['author'];
  location: SnapshotLocation;
}

/**
 * The cached releases from a manifest, in manifest order (oldest → newest), each
 * mapped to the snapshot location to load. The baseline version maps to 'baseline';
 * other cached versions map to their snapshots dir. Uncached releases are dropped.
 */
export function cachedReleases(releases: ReleasesDoc | null): CachedRelease[] {
  if (!releases) return [];
  return releases.releases
    .filter((r) => r.snapshot)
    .map((r) => ({
      version: r.version,
      author: r.author,
      location: r.version === releases.baseline ? 'baseline' : { version: r.version },
    }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/changeTrackingView.test.ts`
Expected: PASS (all groups).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` — clean.
Run: `npm run lint` — clean.

- [ ] **Step 6: Commit**

```bash
git add src/changeTrackingView.ts src/__tests__/changeTrackingView.test.ts
git commit -m "feat(editor): pure presentation helpers for change-tracking UI

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Redline + attribution in the SRS/VTP tables

**Files:**
- Modify: `src/components/SRSTable.tsx`, `src/components/VTPTable.tsx`
- Test: `src/components/__tests__/SRSTable.test.tsx`, `src/components/__tests__/VTPTable.test.tsx`

- [ ] **Step 1: Write failing tests — append to `src/components/__tests__/SRSTable.test.tsx`**

Add this describe block (the file already defines `srs`/`vtp` fixtures and imports `render`, `screen`, `vi`, `SRSTable`):

```ts
import type { RedlineView, AttributionView } from '../../changeTracking';

describe('SRSTable change tracking', () => {
  it('marks added and modified rows and renders the History column + removed panel', () => {
    const redline: RedlineView = {
      byId: new Map([
        ['r_001', { status: 'modified', changedFields: ['text'] }],
      ]),
      removed: [{ id: 'r_old', status: 'removed', before: { id: 'r_old', text: 'Old requirement' } }],
    };
    const attribution = new Map<string, AttributionView>([
      ['r_001', { addedIn: 'v1.0', addedBoundary: true, lastChangedIn: 'v2.0', author: { name: 'Sam', email: 's@x.com' } }],
    ]);
    const { container } = render(
      <SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} redline={redline} attribution={attribution} />,
    );
    // modified row gets the warning class
    expect(container.querySelector('tr.warning')).not.toBeNull();
    // History column shows the attribution label
    expect(screen.getByText('added v1.0 · changed v2.0 · Sam')).toBeInTheDocument();
    // removed panel lists the removed item
    expect(screen.getByText(/Removed since baseline/)).toBeInTheDocument();
    expect(screen.getByText('Old requirement')).toBeInTheDocument();
  });

  it('renders normally with no redline/attribution props (no History column)', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    expect(screen.queryByText('History')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the SRS test to verify it fails**

Run: `npx vitest run src/components/__tests__/SRSTable.test.tsx`
Expected: FAIL — `SRSTable` doesn't accept `redline`/`attribution`; no History column / removed panel.

- [ ] **Step 3: Modify `src/components/SRSTable.tsx`**

3a. Add imports below the existing imports:

```ts
import type { RedlineView, AttributionView } from '../changeTracking';
import { rowStatusClass, isCellChanged, attributionLabel } from '../changeTrackingView';
```

3b. Extend the props interface and the component signature:

```ts
interface SRSTableProps {
  doc: SrsDoc;
  vtpDoc: VtpDoc | null;
  onSave: (doc: SrsDoc) => void;
  redline?: RedlineView;
  attribution?: Map<string, AttributionView>;
}
```
```ts
const SRSTable: React.FC<SRSTableProps> = ({ doc, vtpDoc, onSave, redline, attribution }) => {
```

3c. In `<thead>`, add a History header between the Tests and Actions headers:

```tsx
            <th style={{ width: 60 }}>Tests</th>
            {attribution && <th style={{ width: 150 }}>History</th>}
            <th style={{ width: 90 }}>Actions</th>
```

3d. Replace the row opening tag and the editable cells so redline drives the classes. The current row is:
```tsx
            <tr key={item.id} className={item.heading ? 'info' : ''}>
              <td>{item.heading ? <em>heading</em> : renderCell(index, 'code')}</td>
              <td style={item.heading ? { fontWeight: 'bold' } : undefined}>{renderCell(index, 'text')}</td>
              <td>{item.heading ? '' : renderCell(index, 'tags')}</td>
              <td>{item.heading ? '' : renderCell(index, 'hazards')}</td>
              <td>{item.heading ? '' : testCounts.get(item.id) ?? 0}</td>
```
Replace it with (introducing a per-row `rl` and cell classes, plus the History cell after the Tests cell):
```tsx
            <tr key={item.id} className={rowStatusClass(item.heading, redline?.byId.get(item.id))}>
              <td className={isCellChanged(redline?.byId.get(item.id), 'code') ? 'ct-changed' : undefined}>{item.heading ? <em>heading</em> : renderCell(index, 'code')}</td>
              <td className={isCellChanged(redline?.byId.get(item.id), 'text') ? 'ct-changed' : undefined} style={item.heading ? { fontWeight: 'bold' } : undefined}>{renderCell(index, 'text')}</td>
              <td className={isCellChanged(redline?.byId.get(item.id), 'tags') ? 'ct-changed' : undefined}>{item.heading ? '' : renderCell(index, 'tags')}</td>
              <td className={isCellChanged(redline?.byId.get(item.id), 'hazards') ? 'ct-changed' : undefined}>{item.heading ? '' : renderCell(index, 'hazards')}</td>
              <td>{item.heading ? '' : testCounts.get(item.id) ?? 0}</td>
              {attribution && <td className="ct-attribution">{item.heading ? '' : attributionLabel(attribution.get(item.id))}</td>}
```
(Leave the Actions `<td>` that follows unchanged.)

3e. Add the removed panel immediately AFTER the closing `</table>` and before the closing `</div>` of `srs-table-container`:

```tsx
      {redline && redline.removed.length > 0 && (
        <div className="panel panel-default ct-removed">
          <div className="panel-heading"><strong>Removed since baseline ({redline.removed.length})</strong></div>
          <ul className="list-group">
            {redline.removed.map((c) => (
              <li key={c.id} className="list-group-item">
                {c.before?.code ? <strong>{c.before.code}: </strong> : null}
                {c.before?.text}
              </li>
            ))}
          </ul>
        </div>
      )}
```

- [ ] **Step 4: Run the SRS test to verify it passes**

Run: `npx vitest run src/components/__tests__/SRSTable.test.tsx`
Expected: PASS (existing tests + 2 new).

- [ ] **Step 5: Write failing tests — append to `src/components/__tests__/VTPTable.test.tsx`**

```ts
import type { RedlineView, AttributionView } from '../../changeTracking';

describe('VTPTable change tracking', () => {
  it('marks a modified row, shows attribution, and lists removed tests', () => {
    const redline: RedlineView = {
      byId: new Map([['t_001', { status: 'modified', changedFields: ['expected'] }]]),
      removed: [{ id: 't_old', status: 'removed', before: { id: 't_old', text: 'Old test' } }],
    };
    const attribution = new Map<string, AttributionView>([
      ['t_001', { addedIn: 'v1.0', addedBoundary: false, lastChangedIn: 'v1.0', author: { name: 'Sam', email: 's@x.com' } }],
    ]);
    const { container } = render(
      <VTPTable doc={vtp} srsDoc={srs} onSave={vi.fn()} redline={redline} attribution={attribution} />,
    );
    expect(container.querySelector('tr.warning')).not.toBeNull();
    expect(screen.getByText('v1.0 · Sam')).toBeInTheDocument();
    expect(screen.getByText(/Removed since baseline/)).toBeInTheDocument();
    expect(screen.getByText('Old test')).toBeInTheDocument();
  });
});
```

Note: the existing `VTPTable.test.tsx` defines `srs`/`vtp` fixtures and imports `render`/`screen`/`vi`/`VTPTable`. If `vtp`'s test id is not `t_001`, adjust the redline/attribution keys to match the fixture's actual test id before running.

- [ ] **Step 6: Modify `src/components/VTPTable.tsx`**

6a. Add the same two imports as SRSTable (Step 3a).

6b. Extend props + signature:
```ts
interface VTPTableProps {
  doc: VtpDoc;
  srsDoc: SrsDoc | null;
  onSave: (doc: VtpDoc) => void;
  redline?: RedlineView;
  attribution?: Map<string, AttributionView>;
}
```
```ts
const VTPTable: React.FC<VTPTableProps> = ({ doc, srsDoc, onSave, redline, attribution }) => {
```

6c. Add a History header between Result and Actions in `<thead>`:
```tsx
            <th style={{ width: 110 }}>Result</th>
            {attribution && <th style={{ width: 150 }}>History</th>}
            <th style={{ width: 90 }}>Actions</th>
```

6d. The current row keeps a `danger` class for bad refs. Replace the row opening tag and add cell classes + the History cell. Current:
```tsx
            <tr key={item.id} className={srsDoc && rowHasBadRef(item) ? 'danger' : ''}>
              <td>{renderCell(index, 'code')}</td>
              <td>{renderCell(index, 'text')}</td>
              <td>{renderCell(index, 'verifies')}</td>
              <td>{renderCell(index, 'expected')}</td>
```
Replace with (bad-ref danger takes precedence, else redline status):
```tsx
            <tr key={item.id} className={srsDoc && rowHasBadRef(item) ? 'danger' : rowStatusClass(item.heading, redline?.byId.get(item.id))}>
              <td className={isCellChanged(redline?.byId.get(item.id), 'code') ? 'ct-changed' : undefined}>{renderCell(index, 'code')}</td>
              <td className={isCellChanged(redline?.byId.get(item.id), 'text') ? 'ct-changed' : undefined}>{renderCell(index, 'text')}</td>
              <td className={isCellChanged(redline?.byId.get(item.id), 'verifies') ? 'ct-changed' : undefined}>{renderCell(index, 'verifies')}</td>
              <td className={isCellChanged(redline?.byId.get(item.id), 'expected') ? 'ct-changed' : undefined}>{renderCell(index, 'expected')}</td>
```
Then add the History cell AFTER the Result `<td>...</td>` (the one containing the `<select>`), before the Actions `<td>`:
```tsx
              {attribution && <td className="ct-attribution">{item.heading ? '' : attributionLabel(attribution.get(item.id))}</td>}
```

6e. Add the removed panel after `</table>` (before the existing `{!srsDoc && (...)}` block):
```tsx
      {redline && redline.removed.length > 0 && (
        <div className="panel panel-default ct-removed">
          <div className="panel-heading"><strong>Removed since baseline ({redline.removed.length})</strong></div>
          <ul className="list-group">
            {redline.removed.map((c) => (
              <li key={c.id} className="list-group-item">
                {c.before?.code ? <strong>{c.before.code}: </strong> : null}
                {c.before?.text}
              </li>
            ))}
          </ul>
        </div>
      )}
```

- [ ] **Step 7: Run both table tests + full suite + typecheck + lint**

Run: `npx vitest run src/components/__tests__/SRSTable.test.tsx src/components/__tests__/VTPTable.test.tsx`
Expected: PASS.
Run: `npm test` — all green.
Run: `npx tsc --noEmit` — clean.
Run: `npm run lint` — clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/SRSTable.tsx src/components/VTPTable.tsx src/components/__tests__/SRSTable.test.tsx src/components/__tests__/VTPTable.test.tsx
git commit -m "feat(editor): redline highlighting + inline attribution in SRS/VTP tables

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: VersionTimeline + JobControl components

**Files:**
- Create: `src/components/VersionTimeline.tsx`, `src/components/JobControl.tsx`
- Test: `src/components/__tests__/VersionTimeline.test.tsx`, `src/components/__tests__/JobControl.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/__tests__/VersionTimeline.test.tsx`:

```ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import VersionTimeline from '../VersionTimeline';
import type { ReleasesDoc } from '../../shared';

const sam = { name: 'Sam', email: 's@x.com' };
const releases: ReleasesDoc = {
  schemaVersion: '1.0', type: 'releases', name: 'AcmeApp', tagPattern: 'v*', baseline: 'v2.0',
  releases: [
    { version: 'v1.0', ref: 'v1.0', date: '2025-01-01', author: sam, snapshot: '.specpad/snapshots/v1.0' },
    { version: 'v2.0', ref: 'v2.0', date: '2026-01-01', author: sam, snapshot: '.specpad/baseline' },
  ],
};

describe('VersionTimeline', () => {
  it('renders nothing when there are no releases', () => {
    const { container } = render(<VersionTimeline releases={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('lists each release with its date and author, flagging the baseline', () => {
    render(<VersionTimeline releases={releases} />);
    expect(screen.getByText('v1.0')).toBeInTheDocument();
    expect(screen.getByText('v2.0')).toBeInTheDocument();
    expect(screen.getByText(/baseline/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Sam/).length).toBeGreaterThan(0);
  });
});
```

Create `src/components/__tests__/JobControl.test.tsx`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JobControl from '../JobControl';

describe('JobControl', () => {
  it('shows the current job when set', () => {
    render(<JobControl job={{ schemaVersion: '1.0', type: 'job', job: 'PROJ-7', title: 'SSO' }} onSet={vi.fn()} />);
    expect(screen.getByDisplayValue('PROJ-7')).toBeInTheDocument();
  });

  it('calls onSet with the entered job id and title', () => {
    const onSet = vi.fn();
    render(<JobControl job={null} onSet={onSet} />);
    fireEvent.change(screen.getByPlaceholderText('Job id (e.g. PROJ-123)'), { target: { value: 'PROJ-9' } });
    fireEvent.change(screen.getByPlaceholderText('Title (optional)'), { target: { value: 'Add login' } });
    fireEvent.click(screen.getByText('Set job'));
    expect(onSet).toHaveBeenCalledWith('PROJ-9', 'Add login');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/__tests__/VersionTimeline.test.tsx src/components/__tests__/JobControl.test.tsx`
Expected: FAIL — components don't exist.

- [ ] **Step 3: Create `src/components/VersionTimeline.tsx`**

```tsx
/**
 * VersionTimeline — read-only release history from the change-tracking manifest.
 * Renders nothing when there is no manifest (degraded state handled by the parent).
 */
import React from 'react';
import type { ReleasesDoc } from '../shared';

interface VersionTimelineProps {
  releases: ReleasesDoc | null;
}

const VersionTimeline: React.FC<VersionTimelineProps> = ({ releases }) => {
  if (!releases || releases.releases.length === 0) return null;
  // Newest first for display.
  const rows = [...releases.releases].reverse();
  return (
    <div className="panel panel-default ct-timeline">
      <div className="panel-heading"><strong>Version history</strong></div>
      <ul className="list-group">
        {rows.map((r) => (
          <li key={r.version} className="list-group-item">
            <strong>{r.version}</strong>
            {r.version === releases.baseline && <span className="label label-info" style={{ marginLeft: 6 }}>baseline</span>}
            <span className="text-muted" style={{ marginLeft: 8 }}>{r.date} · {r.author.name}</span>
            {!r.snapshot && <span className="text-muted" style={{ marginLeft: 8 }}>(not cached)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default VersionTimeline;
```

- [ ] **Step 4: Create `src/components/JobControl.tsx`**

```tsx
/**
 * JobControl — view/set the current-job marker (<name>.job.json). The job is folded
 * into commit trailers by the skill, linking spec edits to a dev unit.
 */
import React, { useState } from 'react';
import type { JobDoc } from '../shared';

interface JobControlProps {
  job: JobDoc | null;
  onSet: (job: string, title: string) => void;
}

const JobControl: React.FC<JobControlProps> = ({ job, onSet }) => {
  const [jobId, setJobId] = useState(job?.job ?? '');
  const [title, setTitle] = useState(job?.title ?? '');
  return (
    <div className="ct-job-control form-inline" style={{ marginBottom: 10 }}>
      <strong style={{ marginRight: 8 }}>Current job:</strong>
      <input
        type="text"
        className="form-control input-sm"
        placeholder="Job id (e.g. PROJ-123)"
        value={jobId}
        onChange={(e) => setJobId(e.target.value)}
        style={{ marginRight: 6 }}
      />
      <input
        type="text"
        className="form-control input-sm"
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ marginRight: 6 }}
      />
      <button className="btn btn-default btn-sm" disabled={!jobId.trim()} onClick={() => onSet(jobId.trim(), title.trim())}>
        Set job
      </button>
    </div>
  );
};

export default JobControl;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/__tests__/VersionTimeline.test.tsx src/components/__tests__/JobControl.test.tsx`
Expected: PASS.

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit` — clean. Run: `npm run lint` — clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/VersionTimeline.tsx src/components/JobControl.tsx src/components/__tests__/VersionTimeline.test.tsx src/components/__tests__/JobControl.test.tsx
git commit -m "feat(editor): version-history timeline + current-job control components

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Wire change tracking into `LocalApp` + CSS

**Files:**
- Modify: `src/LocalApp.tsx`
- Modify: `src/__tests__/LocalApp.test.tsx` (extend the mock — REQUIRED or the existing test breaks)
- Modify: `src/specpad.less`

- [ ] **Step 1: Extend the `localFileApi` mock in `src/__tests__/LocalApp.test.tsx` FIRST**

LocalApp will call new loaders; the test's `vi.mock('../localFileApi', ...)` must provide them or rendering throws. Add these entries inside the mock's returned object (alongside the existing `serializeDocument: vi.fn(),`):

```ts
  loadReleases: vi.fn(async () => null),
  loadJob: vi.fn(async () => null),
  saveJob: vi.fn(async () => {}),
  loadSnapshot: vi.fn(async () => null),
```

- [ ] **Step 2: Run the existing LocalApp test to confirm it still passes after the mock change (guards the wiring)**

Run: `npx vitest run src/__tests__/LocalApp.test.tsx`
Expected: PASS (still 1 test; mock now covers the new calls LocalApp will make).

- [ ] **Step 3: Add imports to `src/LocalApp.tsx`**

Extend the `./localFileApi` import to add `loadReleases, loadJob, saveJob, loadSnapshot`, and add new imports below the existing component imports:

```ts
import { buildRedline, computeAttribution } from './changeTracking';
import type { SnapshotInput } from './changeTracking';
import { cachedReleases } from './changeTrackingView';
import VersionTimeline from './components/VersionTimeline';
import JobControl from './components/JobControl';
import type { ReleasesDoc, JobDoc, SrsDoc as SrsDocType, VtpDoc as VtpDocType } from './shared';
```
(If `SrsDoc`/`VtpDoc` are already imported as types at the top, you don't need the aliases — reuse the existing imports. The point is `ReleasesDoc` and `JobDoc` must be imported.)

- [ ] **Step 4: Add state + a cache-loading helper in `LocalApp`**

Add these state hooks alongside the existing `useState` declarations:

```ts
  const [releases, setReleases] = useState<ReleasesDoc | null>(null);
  const [job, setJob] = useState<JobDoc | null>(null);
  const [srsBaseline, setSrsBaseline] = useState<SrsDoc | null>(null);
  const [vtpBaseline, setVtpBaseline] = useState<VtpDoc | null>(null);
  const [srsSnapshots, setSrsSnapshots] = useState<SnapshotInput[]>([]);
  const [vtpSnapshots, setVtpSnapshots] = useState<SnapshotInput[]>([]);
```

Add a helper that loads the cache for a project name (place it near `loadNamedDocs`):

```ts
  // Load the change-tracking cache for a project: manifest, job marker, and the
  // cached snapshots (oldest→newest) used for redline (baseline) and attribution.
  const loadChangeTracking = async (name: string) => {
    const rel = await loadReleases(name);
    setReleases(rel);
    setJob(await loadJob(name));
    const cached = cachedReleases(rel);
    const srsSnaps: SnapshotInput[] = [];
    const vtpSnaps: SnapshotInput[] = [];
    let srsBase: SrsDoc | null = null;
    let vtpBase: VtpDoc | null = null;
    for (const c of cached) {
      const s = (await loadSnapshot(c.location, 'srs', name)) as SrsDoc | null;
      const v = (await loadSnapshot(c.location, 'vtp', name)) as VtpDoc | null;
      if (s) srsSnaps.push({ version: c.version, author: c.author, doc: s });
      if (v) vtpSnaps.push({ version: c.version, author: c.author, doc: v });
      if (c.location === 'baseline') { srsBase = s; vtpBase = v; }
    }
    setSrsSnapshots(srsSnaps);
    setVtpSnapshots(vtpSnaps);
    setSrsBaseline(srsBase);
    setVtpBaseline(vtpBase);
  };
```

- [ ] **Step 5: Call `loadChangeTracking` whenever a project's docs load, and clear it when none is selected**

In BOTH `loadNamedDocs` and `loadNamedDocsFrom`, after `setSelectedDocName(name);`, add:
```ts
    await loadChangeTracking(name);
```
In `applyOpened`, in the `else` branch that clears docs (where it sets `setSrsDoc(null)` etc.), also reset the cache state:
```ts
      setReleases(null);
      setJob(null);
      setSrsBaseline(null);
      setVtpBaseline(null);
      setSrsSnapshots([]);
      setVtpSnapshots([]);
```

- [ ] **Step 6: Compute redline + attribution (memoized) and the job handler**

Add after the state declarations (these read the loaded docs/snapshots):

```ts
  const srsRedline = React.useMemo(
    () => (srsDoc ? buildRedline(srsBaseline, srsDoc) : undefined),
    [srsBaseline, srsDoc],
  );
  const vtpRedline = React.useMemo(
    () => (vtpDoc ? buildRedline(vtpBaseline, vtpDoc) : undefined),
    [vtpBaseline, vtpDoc],
  );
  const srsAttribution = React.useMemo(() => computeAttribution(srsSnapshots), [srsSnapshots]);
  const vtpAttribution = React.useMemo(() => computeAttribution(vtpSnapshots), [vtpSnapshots]);

  const handleSetJob = async (jobId: string, title: string) => {
    const name = selectedDocName || projectName;
    const doc: JobDoc = { schemaVersion: '1.0', type: 'job', job: jobId, ...(title ? { title } : {}) };
    try {
      await saveJob(name, doc);
      setJob(doc);
      setError(null);
    } catch (err: any) {
      setError(`Failed to set job: ${err.message}`);
    }
  };
```

- [ ] **Step 7: Pass the new props to the tables and render the new panels**

Update the table render lines to pass redline + attribution:
```tsx
        {currentView === 'srs' && srsDoc && <SRSTable key={selectedDocName} doc={srsDoc} vtpDoc={vtpDoc} onSave={handleSave} redline={srsRedline} attribution={srsSnapshots.length ? srsAttribution : undefined} />}
        {currentView === 'vtp' && vtpDoc && <VTPTable key={selectedDocName} doc={vtpDoc} srsDoc={srsDoc} onSave={handleSave} redline={vtpRedline} attribution={vtpSnapshots.length ? vtpAttribution : undefined} />}
```
(Leave the `testing` view line unchanged.)

Add the job control + timeline + degraded note. Put this block right BEFORE the `<div className="content">` line, but only when a document is open:
```tsx
      {isDirectoryOpen && selectedDocName && (
        <div className="change-tracking">
          <JobControl job={job} onSet={handleSetJob} />
          {releases ? (
            <VersionTimeline releases={releases} />
          ) : (
            <div className="alert alert-info">
              Change history unavailable — run <code>specpad refresh</code> to generate the version
              snapshots. You can still edit and save normally.
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 8: Add CSS to `src/specpad.less`**

Append:
```less
tr.warning {
  background-color: #fcf8e3 !important;
}

td.ct-changed {
  box-shadow: inset 3px 0 0 #f0ad4e;
}

.ct-attribution {
  font-size: 12px;
  color: #777;
  white-space: nowrap;
}

.ct-removed .list-group-item {
  color: #a94442;
  text-decoration: line-through;
}

.change-tracking {
  margin-bottom: 15px;
}

.ct-timeline .text-muted {
  font-size: 12px;
}
```

- [ ] **Step 9: Full suite, typecheck, lint, build**

Run: `npm test` — all green (LocalApp test still passes with the extended mock).
Run: `npx tsc --noEmit` — clean.
Run: `npm run lint` — clean.
Run: `npm run build` — succeeds (the production bundle compiles).

- [ ] **Step 10: Commit**

```bash
git add src/LocalApp.tsx src/__tests__/LocalApp.test.tsx src/specpad.less
git commit -m "feat(editor): wire change tracking into LocalApp (redline, timeline, job, degraded)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (against design §4/§8/§9):**
- §8 redline rendering (row + cell highlight, removed panel) → Task 2 (tables) using Task 1 helpers + `buildRedline` wired in Task 4. ✓
- §8 inline attribution (`added vX · last changed vY · author`) → `attributionLabel` (Task 1), History column (Task 2), `computeAttribution` wired (Task 4). ✓
- §8 version-history timeline → `VersionTimeline` (Task 3), rendered in Task 4. ✓
- §8 current-job control writing `<name>.job.json` → `JobControl` (Task 3) + `handleSetJob`/`saveJob` (Task 4). ✓
- §8/§9 degraded "history unavailable — run specpad refresh" when no manifest → Task 4 Step 7. ✓
- §9 shallow attribution ("≤vX" boundary) → `attributionLabel` boundary case (Task 1). ✓
- §4 redline = working-vs-baseline in the UI → `srsRedline`/`vtpRedline` over the baseline snapshot (Task 4). ✓
- Deferred (noted): interactive arbitrary-version comparison; timeline is read-only here.

**2. Placeholder scan:** No TBD/TODO. Every code step has complete code; tests have real assertions; run steps have exact commands + expected results. The VTPTable test note instructs verifying the fixture's test id before running (a guard, not a placeholder).

**3. Type/name consistency:** `RedlineView`/`AttributionView`/`RedlineEntry`/`SnapshotInput` come from `./changeTracking`; `rowStatusClass`/`isCellChanged`/`attributionLabel`/`cachedReleases`/`CachedRelease` from `./changeTrackingView`; `SnapshotLocation` from `./localFileApi`; `ReleasesDoc`/`JobDoc`/`AuthorRef` from `./shared`. The table props (`redline?`, `attribution?`), the `loadChangeTracking` helper, and the memoized `srsRedline`/`vtpRedline`/`srsAttribution`/`vtpAttribution` use these names identically across Tasks 1–4. `attribution` is passed to a table only when its snapshot list is non-empty, so the History column appears exactly when there is data.

---

## Out of scope / follow-ups
- Interactive "compare any two cached versions" selector (timeline is read-only display here).
- Live redline of *unsaved* in-table edits (redline reflects the loaded/saved doc vs baseline; it recomputes on save).
- Dogfooding SpecPad's own `docs/specpad/` with a real manifest (needs tags on this repo) — separate follow-up once the feature is released.
