# SRS Editor — Plan 3: SRSTable Rewrite (hierarchy, menu, show-tests, hazards-out)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `SRSTable` to deliver the visible changes — per-row hamburger menu (replacing the action buttons), Hazards column removed, indentation by `level`, derived dotted heading codes, a per-requirement show-tests expander, and the `ItemInfo` modal — while preserving the existing change-tracking redline highlight.

**Architecture:** `SRSTable` stays the stateful orchestrator over a flat `items` array. It consumes the already-built `RowMenu`/`ItemInfo` (Plan 2), `deriveHeadingCodes` (Plan 1), and the existing `rowStatusClass`/`isCellChanged` redline helpers. Hierarchy is `level`-based; the menu provides all structural edits; rows are HTML5-draggable to reorder. Redline *rendering* stays as-is here (row/cell highlight + removed panel); Plan 4 swaps it to the Word-style `buildRedlineRows`.

**Tech Stack:** React 18 + TypeScript, Bootstrap 3, LESS, Vitest + Testing Library. No new dependencies.

**Source design:** `docs/design/specpad-srs-editor-enhancements-design.md` — §3 (heading codes/indent), §4 (menu), §5 (show-tests), §6 (info modal), §9 (hazards out), §12 (edge cases: indent clamp, delete-confirm).

---

## File Structure

- **Modify** `src/components/SRSTable.tsx` — full rewrite (below).
- **Modify** `src/components/__tests__/SRSTable.test.tsx` — replace UI assertions for the new structure (keep/adjust the existing redline test).
- **Modify** `src/specpad.less` — indentation, show-tests sub-row, menu polish.

---

## Task 1: Rewrite `SRSTable`

**Files:**
- Modify: `src/components/SRSTable.tsx`
- Test: `src/components/__tests__/SRSTable.test.tsx`

- [ ] **Step 1: Replace `src/components/__tests__/SRSTable.test.tsx` entirely with:**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SRSTable from '../SRSTable';
import type { SrsDoc, VtpDoc } from '../../shared';
import type { RedlineView, AttributionView } from '../../changeTracking';

const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'AcmeApp', title: 'Requirements',
  items: [
    { id: 'h_001', heading: true, text: 'Functional', code: 'Func' },
    { id: 'r_001', code: 'FUNC-1', text: 'Shall authenticate.', level: 1 },
  ],
};
const vtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'AcmeApp', title: 'Tests',
  items: [{ id: 't_001', code: 'TEST-1', text: 'Login test', verifies: ['r_001'], expected: 'ok', result: 'passed' }],
};

describe('SRSTable structure', () => {
  it('renders requirement text and code, no Hazards column', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    expect(screen.getByText('Shall authenticate.')).toBeInTheDocument();
    expect(screen.getByText('FUNC-1')).toBeInTheDocument();
    expect(screen.queryByText('Hazards')).toBeNull();
  });

  it('shows a derived dotted code for headings (not the word "heading")', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    expect(screen.getByText('Func')).toBeInTheDocument();
    expect(screen.queryByText('heading')).toBeNull();
  });

  it('uses a per-row hamburger menu instead of action buttons', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    expect(screen.queryByTitle('Add row below')).toBeNull(); // old buttons gone
    expect(screen.getAllByLabelText('Row actions').length).toBe(2); // one per row
  });

  it('test count column shows the verifying-test count', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});

describe('SRSTable hierarchy + menu actions', () => {
  it('adds a child below at level+1 via the menu', () => {
    const onSave = vi.fn();
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={onSave} />);
    // open the heading row's menu (first), add child
    fireEvent.click(screen.getAllByLabelText('Row actions')[0]);
    fireEvent.click(screen.getByText('Child'));
    fireEvent.click(screen.getByText('Save'));
    const saved = onSave.mock.calls[0][0] as SrsDoc;
    expect(saved.items.length).toBe(3);
    expect(saved.items[1].level).toBe(1); // child of a level-0 heading
  });

  it('deletes a requirement after confirmation', () => {
    const onSave = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={onSave} />);
    fireEvent.click(screen.getAllByLabelText('Row actions')[1]); // r_001
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Save'));
    const saved = onSave.mock.calls[0][0] as SrsDoc;
    expect(saved.items.find((i) => i.id === 'r_001')).toBeUndefined();
    vi.restoreAllMocks();
  });

  it('outdent is disabled for a level-0 row', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    fireEvent.click(screen.getAllByLabelText('Row actions')[0]); // heading, level 0
    const outdent = screen.getByText('Outdent').closest('li');
    expect(outdent?.className).toContain('disabled');
  });
});

describe('SRSTable show-tests + info', () => {
  it('expands the verifying tests inline for a requirement', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Show tests for r_001'));
    expect(screen.getByText('Login test')).toBeInTheDocument();
    expect(screen.getByText(/TEST-1/)).toBeInTheDocument();
  });

  it('opens the info modal from the menu', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    fireEvent.click(screen.getAllByLabelText('Row actions')[1]);
    fireEvent.click(screen.getByText('View information'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('r_001')).toBeInTheDocument();
  });
});

describe('SRSTable redline (preserved)', () => {
  it('marks a modified row and lists removed items', () => {
    const redline: RedlineView = {
      byId: new Map([['r_001', { status: 'modified', changedFields: ['text'] }]]),
      removed: [{ id: 'r_old', status: 'removed', before: { id: 'r_old', text: 'Old requirement' } }],
    };
    const attribution = new Map<string, AttributionView>();
    const { container } = render(
      <SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} redline={redline} attribution={attribution} />,
    );
    expect(container.querySelector('tr.warning')).not.toBeNull();
    expect(screen.getByText(/Removed since baseline/)).toBeInTheDocument();
    expect(screen.getByText('Old requirement')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/SRSTable.test.tsx`
Expected: FAIL — old SRSTable has the Hazards column / action buttons / no hamburger.

- [ ] **Step 3: Replace `src/components/SRSTable.tsx` entirely with:**

```tsx
/**
 * SRSTable — requirements editor with hierarchy, a per-row hamburger menu,
 * inline test display, and change-tracking redline highlight.
 * Rows are SRS items keyed by stable `id`; `level` is indent depth; heading rows
 * show a derived dotted code. Test counts are computed on read from the VTP.
 */
import React, { useMemo, useState } from 'react';
import type { SrsDoc, SrsItem, VtpDoc, VtpItem } from '../shared';
import { createSrsItem, generateId, ID_PREFIX } from '../shared';
import type { RedlineView, AttributionView } from '../changeTracking';
import { rowStatusClass, isCellChanged } from '../changeTrackingView';
import { deriveHeadingCodes } from '../outline';
import RowMenu from './RowMenu';
import ItemInfo from './ItemInfo';

interface SRSTableProps {
  doc: SrsDoc;
  vtpDoc: VtpDoc | null;
  onSave: (doc: SrsDoc) => void;
  redline?: RedlineView;
  attribution?: Map<string, AttributionView>;
}

type EditField = 'code' | 'text' | 'tags';
type EditTarget = { index: number; field: EditField } | null;

const INDENT_PX = 22;

const SRSTable: React.FC<SRSTableProps> = ({ doc, vtpDoc, onSave, redline, attribution }) => {
  const [data, setData] = useState<SrsDoc>(doc);
  const [editing, setEditing] = useState<EditTarget>(null);
  const [editValue, setEditValue] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [infoIndex, setInfoIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const headingCodes = useMemo(() => deriveHeadingCodes(data.items), [data.items]);

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

  const rl = (id: string) => redline?.byId.get(id);

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
          {data.items.map((item, index) => {
            const count = testsByReq.get(item.id)?.length ?? 0;
            const open = expanded.has(item.id);
            return (
              <React.Fragment key={item.id}>
                <tr
                  className={rowStatusClass(item.heading, rl(item.id))}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(index)}
                >
                  <td className={isCellChanged(rl(item.id), 'code') ? 'ct-changed' : undefined}
                    style={{ paddingLeft: 8 + (item.level ?? 0) * INDENT_PX }}>
                    {item.heading
                      ? renderCell(index, 'code', <strong>{headingCodes.get(item.id)}</strong>)
                      : renderCell(index, 'code')}
                  </td>
                  <td className={isCellChanged(rl(item.id), 'text') ? 'ct-changed' : undefined}
                    style={item.heading ? { fontWeight: 'bold' } : undefined}>
                    {renderCell(index, 'text')}
                  </td>
                  <td className={isCellChanged(rl(item.id), 'tags') ? 'ct-changed' : undefined}>
                    {item.heading ? '' : renderCell(index, 'tags')}
                  </td>
                  <td>
                    {item.heading ? '' : (
                      <button type="button" className="btn btn-link btn-xs" aria-label={`Show tests for ${item.id}`}
                        onClick={() => toggleTests(item.id)}>
                        {count} {open ? '▾' : '▸'}
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
                          {testsByReq.get(item.id)!.map((t) => (
                            <li key={t.id}>
                              <strong>{t.code || t.id}</strong>: {t.text}
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/SRSTable.test.tsx`
Expected: PASS (all groups). If the redline "modified" row also matches the heading-info class, confirm `tr.warning` targets `r_001` — adjust only if a real mismatch.

- [ ] **Step 5: Add CSS to `src/specpad.less`**

Append:
```less
.srs-table .row-menu .dropdown-menu {
  min-width: 170px;
}

.srs-tests-row > td {
  background-color: #f9f9f9;
  font-size: 0.9em;
  padding: 6px 10px;
}

.srs-tests-row .label {
  font-size: 11px;
  padding: 2px 6px;
}

tr[draggable="true"] {
  cursor: grab;
}
```

- [ ] **Step 6: Full suite, typecheck, lint, build**

Run: `npm test` — all green (note: `LocalApp.test.tsx` renders SRSTable indirectly; confirm it still passes).
Run: `npx tsc --noEmit` — clean.
Run: `npm run lint` — clean.
Run: `npm run build` — clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/SRSTable.tsx src/components/__tests__/SRSTable.test.tsx src/specpad.less
git commit -m "feat(editor): SRSTable hierarchy + hamburger menu + show-tests; drop Hazards column

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (design §3/§4/§5/§6/§9/§12):**
- §4 hamburger replaces action buttons (add above/below/child, add heading, indent/outdent, move, delete, view info) → `RowMenu` wired per row. ✓
- §3 indentation by `level` (paddingLeft) + derived dotted heading codes in the Code cell → `headingCodes` + INDENT_PX. ✓
- §5 show-tests expander listing verifying tests inline → `toggleTests` + the tests sub-row. ✓
- §6 info modal from the menu → `ItemInfo` wired via `infoIndex`. ✓
- §9 Hazards column removed (field retained in data, shown in `ItemInfo`). ✓
- §12 indent clamp (≤ prev+1), outdent floor 0, delete confirm, outdent disabled at level 0 (`canOutdent`). ✓
- Redline highlight preserved (`rowStatusClass`/`isCellChanged` + removed panel); Word-style rendering is Plan 4. ✓
- `onMove` is a no-op (rows are HTML5-draggable directly); drag reorder implemented via `dragIndex`/`onDrop`. Note: the menu "Move" item is presently inert — flagged for Plan 4/polish.

**2. Placeholder scan:** No TBD/TODO; complete component + tests + CSS; exact commands and expected results.

**3. Type/name consistency:** Imports `RowMenu`/`ItemInfo` with the exact prop names from Plan 2 (`onAddAbove`…`onViewInfo`, `canOutdent`; `item`/`code`/`testCount`/`attribution`/`onClose`); `deriveHeadingCodes` from `../outline`; `rowStatusClass`/`isCellChanged` from `../changeTrackingView`; `createSrsItem`/`generateId`/`ID_PREFIX` from `../shared`. `redline`/`attribution` props unchanged from the current signature (LocalApp passes them as-is).

---

## Out of scope (Plan 4)
- Word-style redline rendering via `buildRedlineRows` (interleaved removed rows, red strikethrough) — replaces the `rowStatusClass`/removed-panel approach used here.
- Making the menu "Move" item drive the drag affordance (currently rows are directly draggable; the item is inert).
- VTP table hamburger (SRS only this iteration).
