# SRS Editor — Plan 4: Word-style Redline Rendering

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the SRS redline Word-style — removed rows shown **inline, red + strikethrough** at their baseline position, with added/modified rows highlighted — driven by the pure `buildRedlineRows`, computed live against the latest-release baseline. Also tidy the now-inert "Move" menu item.

**Architecture:** SRSTable swaps its `redline: RedlineView` prop for `baseline: SrsDoc | null` and computes `buildRedlineRows(baseline, data)` itself, so the redline updates live as the user edits (not just on save). The interleaved row list renders removed rows as read-only struck-through rows; non-removed rows map back to their working-array index for editing/menu/drag. The separate "Removed since baseline" panel is removed. LocalApp passes `baseline` instead of `redline`.

**Tech Stack:** React 18 + TypeScript, Bootstrap 3, LESS, Vitest + Testing Library. No new dependencies.

**Source design:** `docs/design/specpad-srs-editor-enhancements-design.md` — §7 (Word-style redline rendering, supersedes the row/cell highlight + removed panel).

---

## File Structure

- **Modify** `src/components/SRSTable.tsx` — render from `buildRedlineRows`; `redline` prop → `baseline`; inline removed rows; drop the panel.
- **Modify** `src/components/__tests__/SRSTable.test.tsx` — update the redline group to the Word-style behavior (pass `baseline`).
- **Modify** `src/LocalApp.tsx` — pass `baseline={srsBaseline}` to SRSTable; drop the now-unused `srsRedline` memo.
- **Modify** `src/specpad.less` — `.ct-removed-row` styling.
- **Modify** `src/components/RowMenu.tsx` + its test — remove the inert "Move" item/`onMove` (Task 2).

---

## Task 1: Word-style redline in SRSTable (+ LocalApp wiring)

**Files:**
- Modify: `src/components/SRSTable.tsx`
- Modify: `src/components/__tests__/SRSTable.test.tsx`
- Modify: `src/LocalApp.tsx`
- Modify: `src/specpad.less`

- [ ] **Step 1: Update the redline test group in `src/components/__tests__/SRSTable.test.tsx`.**

Replace the existing `describe('SRSTable redline (preserved)', ...)` block with:

```tsx
describe('SRSTable redline (Word-style)', () => {
  it('marks modified inline and shows removed rows struck through (no panel)', () => {
    // working doc = `srs` (h_001 heading + r_001 "Shall authenticate.")
    const baseline: SrsDoc = {
      schemaVersion: '1.0', type: 'srs', name: 'AcmeApp', title: 'Requirements',
      items: [
        { id: 'r_001', code: 'FUNC-1', text: 'Old text', level: 1 },
        { id: 'r_old', code: 'OLD-1', text: 'Old requirement', level: 1 },
      ],
    };
    const { container } = render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} baseline={baseline} />);
    // r_001 modified vs baseline -> warning row
    expect(container.querySelector('tr.warning')).not.toBeNull();
    // r_old removed -> inline struck-through row (not a panel)
    const removed = container.querySelector('tr.ct-removed-row');
    expect(removed).not.toBeNull();
    expect(removed?.textContent).toContain('Old requirement');
    expect(screen.queryByText(/Removed since baseline/)).toBeNull(); // panel gone
  });

  it('treats everything as unchanged when there is no baseline', () => {
    const { container } = render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    expect(container.querySelector('tr.warning')).toBeNull();
    expect(container.querySelector('tr.ct-removed-row')).toBeNull();
  });
});
```

(The other describe blocks — structure, hierarchy/menu, show-tests/info — pass no `baseline`, so they render normally; leave them unchanged.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/SRSTable.test.tsx`
Expected: FAIL — SRSTable doesn't accept `baseline`/render `.ct-removed-row` yet.

- [ ] **Step 3: Replace `src/components/SRSTable.tsx` entirely with:**

```tsx
/**
 * SRSTable — requirements editor with hierarchy, a per-row hamburger menu,
 * inline test display, and a Word-style change-tracking redline.
 * Rows are SRS items keyed by stable `id`; `level` is indent depth; heading rows
 * show a derived dotted code. The redline is computed live from the latest-release
 * baseline: added/modified rows are highlighted, removed rows render inline as
 * read-only, struck-through entries at their baseline position.
 */
import React, { useMemo, useState } from 'react';
import type { SrsDoc, SrsItem, VtpDoc, VtpItem } from '../shared';
import { createSrsItem, generateId, ID_PREFIX } from '../shared';
import type { AttributionView, RedlineEntry } from '../changeTracking';
import { buildRedlineRows } from '../changeTracking';
import { rowStatusClass, isCellChanged } from '../changeTrackingView';
import { deriveHeadingCodes } from '../outline';
import RowMenu from './RowMenu';
import ItemInfo from './ItemInfo';

interface SRSTableProps {
  doc: SrsDoc;
  vtpDoc: VtpDoc | null;
  onSave: (doc: SrsDoc) => void;
  baseline?: SrsDoc | null;
  attribution?: Map<string, AttributionView>;
}

type EditField = 'code' | 'text' | 'tags';
type EditTarget = { index: number; field: EditField } | null;

const INDENT_PX = 22;

const SRSTable: React.FC<SRSTableProps> = ({ doc, vtpDoc, onSave, baseline, attribution }) => {
  const [data, setData] = useState<SrsDoc>(doc);
  const [editing, setEditing] = useState<EditTarget>(null);
  const [editValue, setEditValue] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [infoIndex, setInfoIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const headingCodes = useMemo(() => deriveHeadingCodes(data.items), [data.items]);
  const redlineRows = useMemo(() => buildRedlineRows(baseline ?? null, data), [baseline, data]);
  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    data.items.forEach((it, i) => m.set(it.id, i));
    return m;
  }, [data.items]);

  const testsByReq = useMemo(() => {
    const m = new Map<string, VtpItem[]>();
    for (const t of vtpDoc?.items ?? []) {
      for (const ref of t.verifies ?? []) {
        const list = m.get(ref) ?? [];
        list.push(t);
        m.set(ref, list);
      }
    }
    return m;
  }, [vtpDoc]);

  const ids = () => data.items.map((i) => i.id);
  const update = (items: SrsItem[]) => setData({ ...data, items });

  const startEdit = (index: number, field: EditField) => {
    const value = data.items[index][field];
    setEditing({ index, field });
    setEditValue(Array.isArray(value) ? value.join(', ') : value ?? '');
  };
  const commitEdit = () => {
    if (!editing) return;
    const items = data.items.slice();
    const item: SrsItem = { ...items[editing.index] };
    if (editing.field === 'tags') {
      item.tags = editValue.split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      item[editing.field] = editValue;
    }
    items[editing.index] = item;
    update(items);
    setEditing(null);
  };

  const insertAt = (index: number, item: SrsItem) => {
    const items = data.items.slice();
    items.splice(index, 0, item);
    update(items);
  };
  const levelOf = (i: number) => data.items[i].level ?? 0;
  const addAbove = (i: number) => insertAt(i, createSrsItem(ids(), levelOf(i)));
  const addBelow = (i: number) => insertAt(i + 1, createSrsItem(ids(), levelOf(i)));
  const addChild = (i: number) => insertAt(i + 1, createSrsItem(ids(), levelOf(i) + 1));
  const addHeading = (i: number) => {
    const item: SrsItem = { id: generateId(ID_PREFIX.heading, ids()), text: '', heading: true };
    if (levelOf(i) > 0) item.level = levelOf(i);
    insertAt(i + 1, item);
  };
  const setLevel = (i: number, level: number) => {
    const items = data.items.slice();
    const item: SrsItem = { ...items[i] };
    if (level > 0) item.level = level; else delete item.level;
    items[i] = item;
    update(items);
  };
  const indent = (i: number) => setLevel(i, Math.min(levelOf(i) + 1, i > 0 ? levelOf(i - 1) + 1 : 0));
  const outdent = (i: number) => setLevel(i, Math.max(0, levelOf(i) - 1));
  const deleteRow = (i: number) => {
    if (!confirm('Delete this requirement?')) return;
    const items = data.items.slice();
    items.splice(i, 1);
    update(items);
  };
  const toggleTests = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };
  const onDrop = (target: number) => {
    if (dragIndex === null || dragIndex === target) { setDragIndex(null); return; }
    const items = data.items.slice();
    const [moved] = items.splice(dragIndex, 1);
    items.splice(dragIndex < target ? target - 1 : target, 0, moved);
    update(items);
    setDragIndex(null);
  };

  const renderEdit = (field: EditField) => {
    const isLong = field === 'text';
    const common = {
      className: 'form-control',
      value: editValue,
      autoFocus: true,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditValue(e.target.value),
      onBlur: commitEdit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && !isLong) { e.preventDefault(); commitEdit(); }
        if (e.key === 'Escape') setEditing(null);
      },
    };
    return isLong ? <textarea {...common} rows={3} /> : <input type="text" {...common} />;
  };

  const renderCell = (index: number, field: EditField, display?: React.ReactNode) => {
    if (editing?.index === index && editing.field === field) return renderEdit(field);
    const raw = data.items[index][field];
    const shown = display ?? (Array.isArray(raw) ? raw.join(', ') : raw);
    return (
      <div className="editable-cell" style={{ cursor: 'pointer', minHeight: 20, whiteSpace: 'pre-wrap' }}
        onClick={() => startEdit(index, field)}>
        {shown || <span style={{ color: '#ccc' }}>(empty)</span>}
      </div>
    );
  };

  const entryFor = (status: 'added' | 'modified' | 'unchanged', changedFields?: string[]): RedlineEntry | undefined => {
    if (status === 'added') return { status: 'added' };
    if (status === 'modified') return { status: 'modified', changedFields };
    return undefined;
  };

  return (
    <div className="srs-table-container">
      <div style={{ marginBottom: 10 }}>
        <h2>{data.title || 'Requirements'}</h2>
        <strong>Document:</strong> {data.name}
        <button className="btn btn-success btn-sm" style={{ marginLeft: 20 }} onClick={() => onSave(data)}>Save</button>
      </div>
      <table className="table table-bordered table-striped srs-table">
        <thead>
          <tr>
            <th style={{ width: 160 }}>Code</th>
            <th>Text</th>
            <th style={{ width: 150 }}>Tags</th>
            <th style={{ width: 70 }}>Tests</th>
            <th style={{ width: 44 }} />
          </tr>
        </thead>
        <tbody>
          {redlineRows.map((row) => {
            const item = row.item as SrsItem;

            if (row.status === 'removed') {
              return (
                <tr key={`removed-${item.id}`} className="ct-removed-row">
                  <td style={{ paddingLeft: 8 + (item.level ?? 0) * INDENT_PX }}>
                    <del>{item.code || item.id}</del>
                  </td>
                  <td colSpan={4}><del>{item.text}</del></td>
                </tr>
              );
            }

            const index = indexById.get(item.id) ?? 0;
            const entry = entryFor(row.status, row.changedFields);
            const count = testsByReq.get(item.id)?.length ?? 0;
            const open = expanded.has(item.id);
            return (
              <React.Fragment key={item.id}>
                <tr
                  className={rowStatusClass(item.heading, entry)}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(index)}
                >
                  <td className={isCellChanged(entry, 'code') ? 'ct-changed' : undefined}
                    style={{ paddingLeft: 8 + (item.level ?? 0) * INDENT_PX }}>
                    {item.heading
                      ? renderCell(index, 'code', <strong>{headingCodes.get(item.id)}</strong>)
                      : renderCell(index, 'code')}
                  </td>
                  <td className={isCellChanged(entry, 'text') ? 'ct-changed' : undefined}
                    style={item.heading ? { fontWeight: 'bold' } : undefined}>
                    {renderCell(index, 'text')}
                  </td>
                  <td className={isCellChanged(entry, 'tags') ? 'ct-changed' : undefined}>
                    {item.heading ? '' : renderCell(index, 'tags')}
                  </td>
                  <td>
                    {item.heading ? '' : (
                      <button type="button" className="btn btn-link btn-xs" aria-label={`Show tests for ${item.id}`}
                        onClick={() => toggleTests(item.id)}>
                        <span>{count}</span> {open ? '▾' : '▸'}
                      </button>
                    )}
                  </td>
                  <td>
                    <RowMenu
                      onAddAbove={() => addAbove(index)}
                      onAddBelow={() => addBelow(index)}
                      onAddChild={() => addChild(index)}
                      onAddHeading={() => addHeading(index)}
                      onIndent={() => indent(index)}
                      onOutdent={() => outdent(index)}
                      onMove={() => undefined}
                      onDelete={() => deleteRow(index)}
                      onViewInfo={() => setInfoIndex(index)}
                      canOutdent={(item.level ?? 0) > 0}
                    />
                  </td>
                </tr>
                {open && !item.heading && (
                  <tr className="srs-tests-row">
                    <td />
                    <td colSpan={4}>
                      {count === 0 ? (
                        <em className="text-muted">No verifying tests.</em>
                      ) : (
                        <ul className="list-unstyled" style={{ marginBottom: 0 }}>
                          {(testsByReq.get(item.id) ?? []).map((t) => (
                            <li key={t.id}>
                              <strong>{t.code || t.id}</strong>: <span>{t.text}</span>
                              {t.expected ? <span className="text-muted"> — expects: {t.expected}</span> : null}
                              {t.result ? <span className={`label label-${t.result === 'passed' ? 'success' : t.result === 'failed' ? 'danger' : 'default'}`} style={{ marginLeft: 6 }}>{t.result}</span> : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {infoIndex !== null && data.items[infoIndex] && (
        <ItemInfo
          item={data.items[infoIndex]}
          code={data.items[infoIndex].heading ? (headingCodes.get(data.items[infoIndex].id) ?? '') : (data.items[infoIndex].code ?? '')}
          testCount={testsByReq.get(data.items[infoIndex].id)?.length ?? 0}
          attribution={attribution?.get(data.items[infoIndex].id)}
          onClose={() => setInfoIndex(null)}
        />
      )}
    </div>
  );
};

export default SRSTable;
```

- [ ] **Step 4: Run the SRSTable test to verify it passes**

Run: `npx vitest run src/components/__tests__/SRSTable.test.tsx`
Expected: PASS (all groups, including the new Word-style redline group).

- [ ] **Step 5: Wire `baseline` into `SRSTable` from `src/LocalApp.tsx`**

Find the SRS render line (it currently passes `redline={srsRedline}`):
```tsx
        {currentView === 'srs' && srsDoc && <SRSTable key={selectedDocName} doc={srsDoc} vtpDoc={vtpDoc} onSave={handleSave} redline={srsRedline} attribution={srsSnapshots.length ? srsAttribution : undefined} />}
```
Replace it with (`baseline` instead of `redline`):
```tsx
        {currentView === 'srs' && srsDoc && <SRSTable key={selectedDocName} doc={srsDoc} vtpDoc={vtpDoc} onSave={handleSave} baseline={srsBaseline} attribution={srsSnapshots.length ? srsAttribution : undefined} />}
```
Then remove the now-unused `srsRedline` memo (the `const srsRedline = React.useMemo(...)` block for SRS). Leave `vtpRedline` (VTPTable still uses it) and `srsAttribution`/`vtpAttribution` untouched.

- [ ] **Step 6: Add CSS to `src/specpad.less`**

Append:
```less
tr.ct-removed-row > td {
  background-color: #fdf0ef;
}

tr.ct-removed-row del {
  color: #a94442;
}
```

- [ ] **Step 7: Full suite, typecheck, lint, build**

Run: `npm test` — all green (`LocalApp.test.tsx` still passes — it renders SRSTable with no baseline → all unchanged).
Run: `npx tsc --noEmit` — clean (confirm no leftover `srsRedline`/`RedlineView` references).
Run: `npm run lint` — clean.
Run: `npm run build` — clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/SRSTable.tsx src/components/__tests__/SRSTable.test.tsx src/LocalApp.tsx src/specpad.less
git commit -m "feat(editor): Word-style SRS redline (inline struck-through removed rows)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Remove the inert "Move" menu item

**Files:**
- Modify: `src/components/RowMenu.tsx`
- Modify: `src/components/__tests__/RowMenu.test.tsx`
- Modify: `src/components/SRSTable.tsx`

- [ ] **Step 1: Update the RowMenu test.** In `src/components/__tests__/RowMenu.test.tsx`, remove `onMove: vi.fn(),` from the `handlers()` object, and add this assertion to the first test (`hides the menu until the trigger is clicked`), after the `Delete` expectation:

```tsx
    expect(screen.queryByText('Move')).toBeNull();
```

- [ ] **Step 2: Run the RowMenu test to verify it fails**

Run: `npx vitest run src/components/__tests__/RowMenu.test.tsx`
Expected: FAIL — "Move" is still rendered.

- [ ] **Step 3: Remove "Move" from `src/components/RowMenu.tsx`.** Delete `onMove: () => void;` from `RowMenuProps`, and delete the menu line `<li><a href="#" onClick={pick(props.onMove)}>Move</a></li>`. (Rows are directly draggable, so the menu item was redundant.)

- [ ] **Step 4: Remove the `onMove` prop from the `RowMenu` usage in `src/components/SRSTable.tsx`.** Delete the line `onMove={() => undefined}` from the `<RowMenu ... />` props.

- [ ] **Step 5: Run tests + typecheck + lint**

Run: `npx vitest run src/components/__tests__/RowMenu.test.tsx src/components/__tests__/SRSTable.test.tsx` — PASS.
Run: `npm test` — all green.
Run: `npx tsc --noEmit` — clean (no `onMove` references remain).
Run: `npm run lint` — clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/RowMenu.tsx src/components/__tests__/RowMenu.test.tsx src/components/SRSTable.tsx
git commit -m "feat(editor): drop the redundant inert 'Move' menu item (rows are draggable)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (design §7):**
- Word-style redline: removed rows inline, red + strikethrough, at baseline position → `buildRedlineRows` render + `.ct-removed-row` + `<del>` (Task 1). ✓
- Added/modified highlight retained (added→success, modified→warning+cell highlight) via `rowStatusClass`/`isCellChanged` from the row status. ✓
- Live redline (computes against `data` as edited, not just saved) → `buildRedlineRows(baseline ?? null, data)` memo. ✓
- Removed "Removed since baseline" panel → deleted from render; test asserts it's gone. ✓
- §7 "supersedes the row/cell highlight + removed panel" — the `redline` prop is replaced by `baseline`; LocalApp updated. ✓
- Tidy inert "Move" item → Task 2. ✓
- Out of scope (noted): VTPTable still uses the prior redline rendering (this feature targets SRS); a follow-up can mirror it.

**2. Placeholder scan:** No TBD/TODO; full component + tests + CSS + exact LocalApp edits; exact commands and expected results.

**3. Type/name consistency:** SRSTable prop `baseline?: SrsDoc | null` (replaces `redline`); `buildRedlineRows`/`RedlineEntry` imported from `../changeTracking`; `rowStatusClass`/`isCellChanged` still from `../changeTrackingView`; `entryFor` constructs a `RedlineEntry`. LocalApp passes `baseline={srsBaseline}` (existing state) and drops `srsRedline`. RowMenu loses `onMove` from `RowMenuProps` and SRSTable drops the prop — consistent across Task 2.

---

## Out of scope / follow-ups
- VTPTable Word-style redline (still uses the row/cell highlight + removed panel from the change-tracking feature).
- Word-level (within-text) inline diff (deferred per the design).
- After this lands: deploy via `infra/deploy.sh --ship`.
