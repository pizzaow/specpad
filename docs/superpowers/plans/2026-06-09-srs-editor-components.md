# SRS Editor — Plan 2: RowMenu + ItemInfo Components

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the two presentational components the SRSTable rewrite (Plan 3) will use: a per-row hamburger `RowMenu` and a read-only `ItemInfo` modal.

**Architecture:** Both are pure presentational React components driven entirely by props/callbacks — no file I/O, no global state. They use the existing Bootstrap-3 classes already in the app. The table (Plan 3) owns all state and passes handlers down.

**Tech Stack:** React 18 + TypeScript, Bootstrap 3 classes, Vitest + Testing Library. No new dependencies.

**Source design:** `docs/design/specpad-srs-editor-enhancements-design.md` — §4 (hamburger menu items), §6 (info modal contents).

---

## File Structure

- **Create** `src/components/RowMenu.tsx` — the per-row ⋮ dropdown.
- **Create** `src/components/__tests__/RowMenu.test.tsx`.
- **Create** `src/components/ItemInfo.tsx` — the read-only info modal.
- **Create** `src/components/__tests__/ItemInfo.test.tsx`.

**Conventions:** components are `React.FC<Props>` with a top doc comment, Bootstrap classes (`dropdown`, `dropdown-menu`, `modal`, `btn`), matching existing components (e.g. `ValidationPanel.tsx`). Types import from `../shared` and `../changeTracking`.

---

## Task 1: `RowMenu` — per-row hamburger dropdown

**Files:**
- Create: `src/components/RowMenu.tsx`
- Test: `src/components/__tests__/RowMenu.test.tsx`

- [ ] **Step 1: Write the failing test — create `src/components/__tests__/RowMenu.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RowMenu from '../RowMenu';

function handlers() {
  return {
    onAddAbove: vi.fn(), onAddBelow: vi.fn(), onAddChild: vi.fn(), onAddHeading: vi.fn(),
    onIndent: vi.fn(), onOutdent: vi.fn(), onMove: vi.fn(), onDelete: vi.fn(), onViewInfo: vi.fn(),
  };
}

describe('RowMenu', () => {
  it('hides the menu until the trigger is clicked', () => {
    render(<RowMenu {...handlers()} />);
    expect(screen.queryByText('Below')).toBeNull();
    fireEvent.click(screen.getByLabelText('Row actions'));
    expect(screen.getByText('Below')).toBeInTheDocument();
    expect(screen.getByText('Add heading')).toBeInTheDocument();
    expect(screen.getByText('View information')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('fires the matching callback and closes on selection', () => {
    const h = handlers();
    render(<RowMenu {...h} />);
    fireEvent.click(screen.getByLabelText('Row actions'));
    fireEvent.click(screen.getByText('Child'));
    expect(h.onAddChild).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Child')).toBeNull(); // menu closed
  });

  it('does not fire Outdent when canOutdent is false', () => {
    const h = handlers();
    render(<RowMenu {...h} canOutdent={false} />);
    fireEvent.click(screen.getByLabelText('Row actions'));
    fireEvent.click(screen.getByText('Outdent'));
    expect(h.onOutdent).not.toHaveBeenCalled();
  });

  it('closes via the backdrop without firing a callback', () => {
    const h = handlers();
    render(<RowMenu {...h} />);
    fireEvent.click(screen.getByLabelText('Row actions'));
    fireEvent.click(screen.getByTestId('row-menu-backdrop'));
    expect(screen.queryByText('Below')).toBeNull();
    expect(h.onAddBelow).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/RowMenu.test.tsx`
Expected: FAIL — cannot resolve `../RowMenu`.

- [ ] **Step 3: Implement — create `src/components/RowMenu.tsx`**

```tsx
/**
 * RowMenu — the per-row hamburger (⋮) actions dropdown for the SRS table.
 * Purely presentational: every action is a callback the table provides. Opens on
 * click, closes on selection or backdrop click.
 */
import React, { useState } from 'react';

export interface RowMenuProps {
  onAddAbove: () => void;
  onAddBelow: () => void;
  onAddChild: () => void;
  onAddHeading: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onMove: () => void;
  onDelete: () => void;
  onViewInfo: () => void;
  canOutdent?: boolean; // default true; false disables Outdent (already at level 0)
}

const RowMenu: React.FC<RowMenuProps> = (props) => {
  const [open, setOpen] = useState(false);
  const pick = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    fn();
  };
  const outdentDisabled = props.canOutdent === false;

  return (
    <div className={`dropdown row-menu${open ? ' open' : ''}`} style={{ display: 'inline-block' }}>
      <button
        type="button"
        className="btn btn-default btn-xs"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Row actions"
        onClick={() => setOpen((o) => !o)}
      >
        ⋮
      </button>
      {open && (
        <>
          <div
            data-testid="row-menu-backdrop"
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 1 }}
          />
          <ul className="dropdown-menu" style={{ display: 'block', left: 'auto', right: 0, zIndex: 2 }}>
            <li className="dropdown-header">Add requirement</li>
            <li><a href="#" onClick={pick(props.onAddAbove)}>Above</a></li>
            <li><a href="#" onClick={pick(props.onAddBelow)}>Below</a></li>
            <li><a href="#" onClick={pick(props.onAddChild)}>Child</a></li>
            <li role="separator" className="divider" />
            <li><a href="#" onClick={pick(props.onAddHeading)}>Add heading</a></li>
            <li><a href="#" onClick={pick(props.onIndent)}>Indent</a></li>
            <li className={outdentDisabled ? 'disabled' : ''}>
              <a href="#" onClick={(e) => { e.preventDefault(); if (!outdentDisabled) { setOpen(false); props.onOutdent(); } }}>
                Outdent
              </a>
            </li>
            <li><a href="#" onClick={pick(props.onMove)}>Move</a></li>
            <li role="separator" className="divider" />
            <li><a href="#" onClick={pick(props.onViewInfo)}>View information</a></li>
            <li><a href="#" className="text-danger" onClick={pick(props.onDelete)}>Delete</a></li>
          </ul>
        </>
      )}
    </div>
  );
};

export default RowMenu;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/RowMenu.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` — clean. Run: `npm run lint` — clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/RowMenu.tsx src/components/__tests__/RowMenu.test.tsx
git commit -m "feat(editor): RowMenu per-row hamburger actions dropdown

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `ItemInfo` — read-only metadata modal

**Files:**
- Create: `src/components/ItemInfo.tsx`
- Test: `src/components/__tests__/ItemInfo.test.tsx`

- [ ] **Step 1: Write the failing test — create `src/components/__tests__/ItemInfo.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ItemInfo from '../ItemInfo';
import type { SrsItem } from '../../shared';
import type { AttributionView } from '../../changeTracking';

const req: SrsItem = { id: 'r_001', code: 'DOC-1', text: 'Shall work.', level: 1, tags: ['schema'], hazards: ['SEC-1'] };
const attribution: AttributionView = { addedIn: 'v0.1', addedBoundary: true, lastChangedIn: 'v1.0', author: { name: 'Sam', email: 's@x.com' } };

describe('ItemInfo', () => {
  it('shows the item metadata', () => {
    render(<ItemInfo item={req} code="DOC-1" testCount={3} attribution={attribution} onClose={vi.fn()} />);
    expect(screen.getByText('r_001')).toBeInTheDocument();
    expect(screen.getByText('DOC-1')).toBeInTheDocument();
    expect(screen.getByText('schema')).toBeInTheDocument();
    expect(screen.getByText('SEC-1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // test count
    expect(screen.getByText(/≤v0.1/)).toBeInTheDocument();
    expect(screen.getByText(/v1.0 · Sam/)).toBeInTheDocument();
  });

  it('omits the Tests row for a heading', () => {
    const heading: SrsItem = { id: 'h_1', text: 'Section', heading: true };
    render(<ItemInfo item={heading} code="Section" testCount={0} onClose={vi.fn()} />);
    expect(screen.queryByText('Tests')).toBeNull();
  });

  it('calls onClose from the close button and the backdrop', () => {
    const onClose = vi.fn();
    render(<ItemInfo item={req} code="DOC-1" testCount={0} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    fireEvent.click(screen.getByTestId('item-info-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/ItemInfo.test.tsx`
Expected: FAIL — cannot resolve `../ItemInfo`.

- [ ] **Step 3: Implement — create `src/components/ItemInfo.tsx`**

```tsx
/**
 * ItemInfo — read-only metadata modal for an SRS/VTP item (the hamburger's
 * "View information"). Presentational; the table supplies the derived code,
 * test count, and attribution. Hazards live here now the column is gone.
 */
import React from 'react';
import type { SrsItem } from '../shared';
import type { AttributionView } from '../changeTracking';

export interface ItemInfoProps {
  item: SrsItem;
  code: string;
  testCount: number;
  attribution?: AttributionView;
  onClose: () => void;
}

const none = <span className="text-muted">(none)</span>;

const ItemInfo: React.FC<ItemInfoProps> = ({ item, code, testCount, attribution, onClose }) => (
  <div role="dialog" aria-label="Item information">
    <div
      data-testid="item-info-backdrop"
      className="modal-backdrop in"
      style={{ opacity: 0.5 }}
      onClick={onClose}
    />
    <div className="modal in" style={{ display: 'block' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <button type="button" className="close" aria-label="Close" onClick={onClose}>
              <span aria-hidden="true">&times;</span>
            </button>
            <h4 className="modal-title">{item.heading ? 'Heading' : 'Requirement'} information</h4>
          </div>
          <div className="modal-body">
            <dl className="dl-horizontal">
              <dt>ID</dt><dd>{item.id}</dd>
              <dt>Code</dt><dd>{code || none}</dd>
              <dt>Level</dt><dd>{item.level ?? 0}</dd>
              {!item.heading && (<><dt>Tests</dt><dd>{testCount}</dd></>)}
              <dt>Tags</dt><dd>{item.tags?.length ? item.tags.join(', ') : none}</dd>
              <dt>Hazards</dt><dd>{item.hazards?.length ? item.hazards.join(', ') : none}</dd>
              <dt>Added</dt>
              <dd>{attribution ? `${attribution.addedBoundary ? '≤' : ''}${attribution.addedIn}` : <span className="text-muted">(uncommitted)</span>}</dd>
              <dt>Last changed</dt>
              <dd>{attribution ? `${attribution.lastChangedIn} · ${attribution.author.name}` : <span className="text-muted">—</span>}</dd>
            </dl>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-default" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default ItemInfo;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/ItemInfo.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Full suite, typecheck, lint**

Run: `npm test` — all green. Run: `npx tsc --noEmit` — clean. Run: `npm run lint` — clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/ItemInfo.tsx src/components/__tests__/ItemInfo.test.tsx
git commit -m "feat(editor): ItemInfo read-only metadata modal

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (design §4/§6):**
- §4 hamburger items (add above/below/child, add heading, indent/outdent, move, delete, view info) → `RowMenu` (Task 1). ✓
- §4 outdent disabled at level 0 → `canOutdent` prop. ✓
- §6 info modal (id, code, level, tags, hazards, attribution, test count; read-only) → `ItemInfo` (Task 2). ✓
- §6 heading vs requirement (no test count for headings) → `ItemInfo` omits Tests for headings. ✓

**2. Placeholder scan:** No TBD/TODO; complete component code; real test assertions; exact run commands + expected results.

**3. Type/name consistency:** `RowMenuProps` callback names (`onAddAbove`/`onAddBelow`/`onAddChild`/`onAddHeading`/`onIndent`/`onOutdent`/`onMove`/`onDelete`/`onViewInfo`/`canOutdent`) and `ItemInfoProps` (`item`/`code`/`testCount`/`attribution?`/`onClose`) are the exact interfaces Plan 3's SRSTable will wire. `AttributionView` imported from `../changeTracking`; `SrsItem` from `../shared`.

---

## Out of scope (Plan 3 / Plan 4)
- **Plan 3:** `SRSTable` rewrite consuming `RowMenu`/`ItemInfo` — indentation by `level`, derived heading codes, add/indent/outdent/move/delete wiring, show-tests expander, Hazards column removal.
- **Plan 4:** redline rendering via `buildRedlineRows` + CSS.
