# Editor Shell — Plan 1: Lift Editing State (controlled tables + shell-owned save/dirty)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `SRSTable`/`VTPTable`/`TestingView` controlled (`doc` + `onChange`, no internal working-copy, no per-table Save button), and move working/saved/dirty/save ownership into `LocalApp` — the prerequisite for a single menu-bar Save with an unsaved-changes indicator.

**Architecture:** Each table currently holds its own `useState(doc)` working copy and its own Save button, so "unsaved changes" is trapped inside the table. We invert that: the table renders the `doc` prop and routes every document mutation through `onChange(nextDoc)`; only the table's transient UI state (editing cell, expanded rows, open menu/modal) stays local. `LocalApp` holds the working docs (`srsDoc`/`vtpDoc`), per-type dirty flags, and a single `save()`, and renders a temporary Save button (the menu bar moves it in Plan 2).

**Tech Stack:** React 18 + TypeScript, Vitest + Testing Library. No new dependencies.

**Source design:** `docs/design/specpad-editor-shell-design.md` — §2 (lift editing state), §7 (Plan 1).

---

## File Structure

- **Modify** `src/components/SRSTable.tsx` — `onSave` → `onChange`; drop internal `data` state + Save button; route mutations through `onChange`.
- **Modify** `src/components/VTPTable.tsx` — same conversion.
- **Modify** `src/components/TestingView.tsx` — same conversion.
- **Modify** the three component tests — assert `onChange` (no Save click).
- **Modify** `src/LocalApp.tsx` — working/dirty/save ownership; pass `onChange`; temporary Save button.
- **Modify** `src/__tests__/LocalApp.test.tsx` if needed (document switching still works).

**Pattern (applies to all three tables):** every mutation today does `setData({ ...data, items })`. We replace the `const [data, setData] = useState(doc)` with `const data = doc;` and a helper `const update = (items) => onChange({ ...doc, items });`, then route mutations through `update(items)`. The transient `editing`/`editValue`/`expanded`/`infoIndex`/`dragIndex` state stays.

---

## Task 1: Make `SRSTable` controlled

**Files:**
- Modify: `src/components/SRSTable.tsx`
- Test: `src/components/__tests__/SRSTable.test.tsx`

- [ ] **Step 1: Update the tests** in `src/components/__tests__/SRSTable.test.tsx`:
  - Replace every `onSave={vi.fn()}` with `onChange={vi.fn()}`.
  - In the **"adds a child below at level+1 via the menu"** test, remove the `fireEvent.click(screen.getByText('Save'));` line and read the change from `onChange` instead. The test becomes:
    ```tsx
    it('adds a child below at level+1 via the menu', () => {
      const onChange = vi.fn();
      render(<SRSTable doc={srs} vtpDoc={vtp} onChange={onChange} />);
      fireEvent.click(screen.getAllByLabelText('Row actions')[0]);
      fireEvent.click(screen.getByText('Child'));
      const next = onChange.mock.calls.at(-1)![0] as SrsDoc;
      expect(next.items.length).toBe(3);
      expect(next.items[1].level).toBe(1);
    });
    ```
  - In the **"deletes a requirement after confirmation"** test, drop the Save click and read `onChange`:
    ```tsx
    it('deletes a requirement after confirmation', () => {
      const onChange = vi.fn();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      render(<SRSTable doc={srs} vtpDoc={vtp} onChange={onChange} />);
      fireEvent.click(screen.getAllByLabelText('Row actions')[1]);
      fireEvent.click(screen.getByText('Delete'));
      const next = onChange.mock.calls.at(-1)![0] as SrsDoc;
      expect(next.items.find((i) => i.id === 'r_001')).toBeUndefined();
      vi.restoreAllMocks();
    });
    ```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/SRSTable.test.tsx`
Expected: FAIL — `SRSTable` still has `onSave` (TS/prop mismatch) and a Save button.

- [ ] **Step 3: Edit `src/components/SRSTable.tsx`:**
  1. In `SRSTableProps`, replace `onSave: (doc: SrsDoc) => void;` with `onChange: (doc: SrsDoc) => void;`.
  2. Update the component signature destructure: `({ doc, vtpDoc, onChange, baseline, attribution })`.
  3. Replace `const [data, setData] = useState<SrsDoc>(doc);` with `const data = doc;`.
  4. Replace `const update = (items: SrsItem[]) => setData({ ...data, items });` with `const update = (items: SrsItem[]) => onChange({ ...doc, items });`.
  5. Remove the Save button line in the header: delete `<button className="btn btn-success btn-sm" style={{ marginLeft: 20 }} onClick={() => onSave(data)}>Save</button>`.
  6. Remove the now-unused `useState` import only if nothing else uses it — it is still used (`editing`, `editValue`, `expanded`, `infoIndex`, `dragIndex`), so keep the import.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/SRSTable.test.tsx`
Expected: PASS (all groups; edits now fire `onChange` immediately).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `LocalApp.tsx` (still passes `onSave` to SRSTable) — that is fixed in Task 4. SRSTable itself is clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/SRSTable.tsx src/components/__tests__/SRSTable.test.tsx
git commit -m "refactor(editor): make SRSTable controlled (onChange, no internal Save)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Make `VTPTable` controlled

**Files:**
- Modify: `src/components/VTPTable.tsx`
- Test: `src/components/__tests__/VTPTable.test.tsx`

- [ ] **Step 1: Update the tests** in `src/components/__tests__/VTPTable.test.tsx`: replace every `onSave={vi.fn()}` with `onChange={vi.fn()}`. (The existing VTP tests assert rendering/redline, not Save, so no other change is needed.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/VTPTable.test.tsx`
Expected: FAIL — `VTPTable` still declares `onSave`.

- [ ] **Step 3: Edit `src/components/VTPTable.tsx`:**
  1. In `VTPTableProps`, replace `onSave: (doc: VtpDoc) => void;` with `onChange: (doc: VtpDoc) => void;`.
  2. Signature: `({ doc, srsDoc, onChange, redline, attribution })`.
  3. Replace `const [data, setData] = useState<VtpDoc>(doc);` with:
     ```tsx
     const data = doc;
     const update = (items: VtpItem[]) => onChange({ ...doc, items });
     ```
  4. Replace each `setData({ ...data, items });` (in `commitEdit`, `setResult`, `addRow`, `deleteRow`, `moveRow`) with `update(items);`.
  5. Remove the Save button: delete `<button className="btn btn-success btn-sm" style={{ marginLeft: 20 }} onClick={() => onSave(data)}>Save</button>`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/VTPTable.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck** — `npx tsc --noEmit` (errors only in LocalApp, fixed in Task 4).

- [ ] **Step 6: Commit**

```bash
git add src/components/VTPTable.tsx src/components/__tests__/VTPTable.test.tsx
git commit -m "refactor(editor): make VTPTable controlled (onChange, no internal Save)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Make `TestingView` controlled

**Files:**
- Modify: `src/components/TestingView.tsx`
- Test: `src/components/__tests__/TestingView.test.tsx`

- [ ] **Step 1: Update the test** in `src/components/__tests__/TestingView.test.tsx`. The existing test changes a result and clicks Save, reading `onSave`. Rewrite it to read `onChange` directly (the result change now fires `onChange` immediately). Replace the test body so it:
  - renders `<TestingView doc={vtp} onChange={onChange} />`,
  - changes the result `<select>` for the test row,
  - asserts `onChange` was called with a VTP doc whose matching item has the new `result`.
  
  Concretely (adapt the fixture/ids to the file's existing `vtp` fixture):
  ```tsx
  it('reports a result change to onChange', () => {
    const onChange = vi.fn();
    render(<TestingView doc={vtp} onChange={onChange} />);
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'passed' } });
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.items.find((i: { id: string }) => i.id === vtp.items[0].id)?.result).toBe('passed');
  });
  ```
  Replace any other `onSave={vi.fn()}` with `onChange={vi.fn()}`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/TestingView.test.tsx`
Expected: FAIL — `TestingView` still declares `onSave`/renders a Save button.

- [ ] **Step 3: Edit `src/components/TestingView.tsx`:**
  1. In `TestingViewProps`, replace `onSave: (doc: VtpDoc) => void;` with `onChange: (doc: VtpDoc) => void;`.
  2. Signature: `({ doc, onChange })`.
  3. Replace `const [data, setData] = useState<VtpDoc>(doc);` with:
     ```tsx
     const data = doc;
     const update = (items: VtpDoc['items']) => onChange({ ...doc, items });
     ```
  4. In `setResult` and `commitNotes`, replace `setData({ ...data, items });` with `update(items);`.
  5. Remove the Save button: delete `<button className="btn btn-success btn-sm" style={{ marginLeft: 20 }} onClick={() => onSave(data)}>Save</button>`.
  6. `useState` is still used by `editingNotes`/`editValue` — keep the import.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/TestingView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck** — `npx tsc --noEmit` (errors only in LocalApp, fixed next).

- [ ] **Step 6: Commit**

```bash
git add src/components/TestingView.tsx src/components/__tests__/TestingView.test.tsx
git commit -m "refactor(editor): make TestingView controlled (onChange, no internal Save)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `LocalApp` owns working/dirty/save

**Files:**
- Modify: `src/LocalApp.tsx`
- Test: `src/__tests__/LocalApp.test.tsx`

- [ ] **Step 1: Add dirty state.** Alongside the existing `useState` declarations in `LocalApp`, add:
```tsx
  const [dirtySrs, setDirtySrs] = useState(false);
  const [dirtyVtp, setDirtyVtp] = useState(false);
```

- [ ] **Step 2: Replace `handleSave` with change + persist + save.** Replace the entire existing `handleSave` function with:
```tsx
  // Tables are controlled: an edit replaces the working doc and marks it dirty.
  const handleChange = (next: SrsDoc | VtpDoc) => {
    if (next.type === 'srs') { setSrsDoc(next); setDirtySrs(true); }
    else { setVtpDoc(next); setDirtyVtp(true); }
  };

  const persist = async (doc: SrsDoc | VtpDoc) => {
    if (supportsFileSystemAccess && hasOpenDirectory()) await saveDocument(doc);
    else saveFileFallback(serializeDocument(doc), `${doc.name}.${doc.type}.json`);
  };

  const dirty = dirtySrs || dirtyVtp;

  const save = async () => {
    try {
      if (dirtySrs && srsDoc) { await persist(srsDoc); setDirtySrs(false); }
      if (dirtyVtp && vtpDoc) { await persist(vtpDoc); setDirtyVtp(false); }
      setError(null);
    } catch (err: any) {
      setError(`Failed to save: ${err.message}`);
    }
  };
```

- [ ] **Step 3: Clear dirty on load.** In BOTH `loadNamedDocs` and `loadNamedDocsFrom`, after the `setSelectedDocName(name);` line (and after `await loadChangeTracking(name);` if present), add:
```tsx
    setDirtySrs(false);
    setDirtyVtp(false);
```
Also in `handleOpenFallback`, after it sets `setSrsDoc`/`setVtpDoc`, add the same two lines (the freshly opened file is not dirty).

- [ ] **Step 4: Route the tables through `handleChange`.** Update the three table render lines:
```tsx
        {currentView === 'srs' && srsDoc && <SRSTable key={selectedDocName} doc={srsDoc} vtpDoc={vtpDoc} onChange={handleChange} baseline={srsBaseline} attribution={srsSnapshots.length ? srsAttribution : undefined} />}
        {currentView === 'vtp' && vtpDoc && <VTPTable key={selectedDocName} doc={vtpDoc} srsDoc={srsDoc} onChange={handleChange} redline={vtpRedline} attribution={vtpSnapshots.length ? vtpAttribution : undefined} />}
        {currentView === 'testing' && vtpDoc && <TestingView key={selectedDocName} doc={vtpDoc} onChange={handleChange} />}
```

- [ ] **Step 5: Add a temporary Save button** to the toolbar (the menu bar replaces it in Plan 2). In the `isDirectoryOpen` branch of the toolbar `btn-group`, add as the first child (before "New Document"):
```tsx
              <button className="btn btn-success" disabled={!dirty} onClick={save}>Save{dirty ? ' ●' : ''}</button>
```

- [ ] **Step 6: Confirm no leftover `handleSave` references.**

Run: `grep -n "handleSave" src/LocalApp.tsx`
Expected: no matches. (All call sites now use `handleChange`/`save`.)

- [ ] **Step 7: Run the LocalApp test + full suite + typecheck + lint + build**

Run: `npx vitest run src/__tests__/LocalApp.test.tsx`
Expected: PASS (document switching still works; tables are controlled, `key` still remounts on switch). If the test referenced the old Save flow, update it to the controlled model; it should only assert switching (`Requirement A`/`Requirement B`), which is unaffected.
Run: `npm test` — all green.
Run: `npx tsc --noEmit` — clean.
Run: `npm run lint` — clean.
Run: `npm run build` — clean.

- [ ] **Step 8: Commit**

```bash
git add src/LocalApp.tsx src/__tests__/LocalApp.test.tsx
git commit -m "refactor(editor): LocalApp owns working/dirty/save; tables controlled

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (design §2/§7 Plan 1):**
- Tables controlled (`doc` + `onChange`, no internal working copy, no per-table Save) → Tasks 1–3. ✓
- `LocalApp` owns working (`srsDoc`/`vtpDoc`), dirty (`dirtySrs`/`dirtyVtp`), and a single `save()` → Task 4. ✓
- Dirty cleared on load/open; set on edit → Task 4 Steps 1–3. ✓
- Temporary Save button until the menu bar (Plan 2) → Task 4 Step 5. ✓
- No visual change beyond the consolidated Save button (per the design's "no visual change yet"). ✓
- Out of scope here: MenuBar, tabs, status bar, version dialog, unsaved-changes guard, Ctrl-S/beforeunload (Plans 2–3).

**2. Placeholder scan:** No TBD/TODO; every step has concrete edits, exact commands, and expected results.

**3. Type/name consistency:** all three tables expose `onChange: (doc) => void` (typed to their doc); `LocalApp.handleChange(next: SrsDoc | VtpDoc)` dispatches by `next.type` (matching the old `handleSave` dispatch); `dirtySrs`/`dirtyVtp`/`dirty`/`save`/`persist` are used consistently. The `update(items)` helper replaces `setData({ ...data, items })` identically across SRS/VTP/Testing.

---

## Out of scope (Plans 2–3)
- **Plan 2:** `MenuBar` (brand + project switcher, File menu, Save+dirty moved here, Ctrl-S, beforeunload, Job chip, version chip).
- **Plan 3:** `ViewTabs` + `StatusBar` (validation summary/details, retire `ValidationPanel`) + `VersionHistoryDialog`; unsaved-changes guard on project/doc switch.
