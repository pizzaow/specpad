# Editor Shell — Plan 2: MenuBar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the page-header title and the toolbar's open/new/change-dir/save buttons + document `<select>` with a proper **MenuBar**: brand + project switcher, a File menu, the Save control (with unsaved-changes indicator + Ctrl/Cmd-S + a `beforeunload` guard), and the current-job chip.

**Architecture:** `MenuBar` is a presentational component — all actions are callbacks `LocalApp` supplies. It uses one open-menu state with a shared backdrop (the `RowMenu` pattern). The Job chip opens a popover that reuses the existing `JobControl`. `LocalApp` renders `MenuBar` at the top, drops the old header/toolbar buttons and the inline `JobControl`, and adds Ctrl-S + `beforeunload`. The view switcher (SRS/VTP/Testing buttons) and the inline `VersionTimeline` stay for now — tabs, status bar, and the version dialog are Plan 3.

**Tech Stack:** React 18 + TypeScript, Bootstrap 3, Vitest + Testing Library. No new dependencies.

**Source design:** `docs/design/specpad-editor-shell-design.md` — §3 (MenuBar), §4 (states), §6 (Save/dirty, Ctrl-S, beforeunload, Job chip). (Scope note: the version chip moves to Plan 3 with `VersionHistoryDialog`.)

---

## File Structure

- **Create** `src/components/MenuBar.tsx` — the menu bar.
- **Create** `src/components/__tests__/MenuBar.test.tsx`.
- **Modify** `src/LocalApp.tsx` — render `MenuBar`; remove the page-header `<h1>`, the toolbar open/new/change-dir/save buttons and the document `<select>`, and the inline `<JobControl>`; add Ctrl-S + `beforeunload`.
- **Modify** `src/__tests__/LocalApp.test.tsx` — the document switch now happens via the MenuBar project switcher (or the test adapts to the new chrome).

---

## Task 1: `MenuBar` component

**Files:**
- Create: `src/components/MenuBar.tsx`
- Test: `src/components/__tests__/MenuBar.test.tsx`

- [ ] **Step 1: Write the failing test — create `src/components/__tests__/MenuBar.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MenuBar from '../MenuBar';
import type { JobDoc } from '../../shared';

function props(over: Partial<React.ComponentProps<typeof MenuBar>> = {}) {
  return {
    projectName: 'AcmeApp',
    projectNames: ['AcmeApp'],
    onSelectProject: vi.fn(),
    isDirectoryOpen: true,
    supportsFileSystemAccess: true,
    dirty: false,
    onSave: vi.fn(),
    onNewDocument: vi.fn(),
    onOpenDirectory: vi.fn(),
    onOpenProjectFile: vi.fn(),
    onOpenFallback: vi.fn(),
    job: null as JobDoc | null,
    onSetJob: vi.fn(),
    ...over,
  };
}

describe('MenuBar', () => {
  it('shows the brand and project name', () => {
    render(<MenuBar {...props()} />);
    expect(screen.getByText('SpecPad')).toBeInTheDocument();
    expect(screen.getByText('AcmeApp')).toBeInTheDocument();
  });

  it('Save is disabled when clean and enabled with a dot when dirty', () => {
    const { rerender } = render(<MenuBar {...props({ dirty: false })} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    rerender(<MenuBar {...props({ dirty: true })} />);
    const save = screen.getByRole('button', { name: /save/i });
    expect(save).not.toBeDisabled();
    expect(save.textContent).toContain('●');
  });

  it('calls onSave when Save is clicked while dirty', () => {
    const p = props({ dirty: true });
    render(<MenuBar {...p} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(p.onSave).toHaveBeenCalledTimes(1);
  });

  it('opens the File menu and fires New document', () => {
    const p = props();
    render(<MenuBar {...p} />);
    fireEvent.click(screen.getByText('File ▾'));
    fireEvent.click(screen.getByText('New document…'));
    expect(p.onNewDocument).toHaveBeenCalledTimes(1);
  });

  it('switches project from the brand dropdown when there are several', () => {
    const p = props({ projectNames: ['AcmeApp', 'OtherApp'] });
    render(<MenuBar {...p} />);
    fireEvent.click(screen.getByText('AcmeApp')); // brand switcher trigger
    fireEvent.click(screen.getByText('OtherApp'));
    expect(p.onSelectProject).toHaveBeenCalledWith('OtherApp');
  });

  it('opens the job popover and sets a job', () => {
    const p = props();
    render(<MenuBar {...p} />);
    fireEvent.click(screen.getByText('Set job ▾'));
    fireEvent.change(screen.getByPlaceholderText('Job id (e.g. PROJ-123)'), { target: { value: 'PROJ-9' } });
    fireEvent.click(screen.getByText('Set job'));
    expect(p.onSetJob).toHaveBeenCalledWith('PROJ-9', '');
  });

  it('in the no-directory state, File offers Open project directory', () => {
    const p = props({ isDirectoryOpen: false, projectName: '', projectNames: [] });
    render(<MenuBar {...p} />);
    fireEvent.click(screen.getByText('File ▾'));
    fireEvent.click(screen.getByText('Open project directory…'));
    expect(p.onOpenDirectory).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull(); // no Save until a dir is open
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/MenuBar.test.tsx`
Expected: FAIL — cannot resolve `../MenuBar`.

- [ ] **Step 3: Implement — create `src/components/MenuBar.tsx`**

```tsx
/**
 * MenuBar — the application menu bar: brand + project switcher, File menu, Save
 * (with an unsaved-changes dot), and the current-job chip. Presentational; every
 * action is a callback the shell (LocalApp) supplies. One open-menu at a time,
 * closed by a shared backdrop (same pattern as RowMenu).
 */
import React, { useState } from 'react';
import type { JobDoc } from '../shared';
import JobControl from './JobControl';

export interface MenuBarProps {
  projectName: string;
  projectNames: string[];
  onSelectProject: (name: string) => void;
  isDirectoryOpen: boolean;
  supportsFileSystemAccess: boolean;
  dirty: boolean;
  onSave: () => void;
  onNewDocument: () => void;
  onOpenDirectory: () => void;
  onOpenProjectFile: () => void;
  onOpenFallback: () => void;
  job: JobDoc | null;
  onSetJob: (job: string, title: string) => void;
}

type OpenMenu = null | 'file' | 'project' | 'job';

const itemStyle: React.CSSProperties = { display: 'block', padding: '7px 14px', whiteSpace: 'nowrap', cursor: 'pointer' };
const chip = 'menubar-chip';

const MenuBar: React.FC<MenuBarProps> = (p) => {
  const [open, setOpen] = useState<OpenMenu>(null);
  const close = () => setOpen(null);
  const toggle = (m: OpenMenu) => setOpen((cur) => (cur === m ? null : m));
  const run = (fn: () => void) => () => { close(); fn(); };

  return (
    <div className="menubar">
      {open && <div data-testid="menubar-backdrop" className="menubar-backdrop" onClick={close} />}

      <span className="menubar-brand">▣ SpecPad</span>

      {p.isDirectoryOpen && p.projectName && (
        p.projectNames.length > 1 ? (
          <span className="menubar-dropdown">
            <button type="button" className={chip} onClick={() => toggle('project')}>{p.projectName} ▾</button>
            {open === 'project' && (
              <ul className="menubar-menu">
                {p.projectNames.map((n) => (
                  <li key={n} style={itemStyle} onClick={run(() => p.onSelectProject(n))}>{n}</li>
                ))}
              </ul>
            )}
          </span>
        ) : (
          <span className="menubar-project">{p.projectName}</span>
        )
      )}

      <span className="menubar-dropdown">
        <button type="button" className={chip} onClick={() => toggle('file')}>File ▾</button>
        {open === 'file' && (
          <ul className="menubar-menu">
            {p.isDirectoryOpen && (
              <li style={itemStyle} onClick={run(p.onNewDocument)}>New document…</li>
            )}
            {p.supportsFileSystemAccess ? (
              <>
                <li style={itemStyle} onClick={run(p.onOpenDirectory)}>Open project directory…</li>
                <li style={itemStyle} onClick={run(p.onOpenProjectFile)}>Open project file…</li>
                {p.isDirectoryOpen && <li style={itemStyle} onClick={run(p.onOpenDirectory)}>Change directory…</li>}
              </>
            ) : (
              <li style={itemStyle} onClick={run(p.onOpenFallback)}>Open document file…</li>
            )}
          </ul>
        )}
      </span>

      {p.isDirectoryOpen && (
        <button type="button" className={chip} aria-label="Save" disabled={!p.dirty} onClick={p.onSave}>
          💾 Save{p.dirty ? ' ●' : ''}
        </button>
      )}

      <span className="menubar-spacer" />

      {p.isDirectoryOpen && (
        <span className="menubar-dropdown">
          <button type="button" className={chip} onClick={() => toggle('job')}>
            {p.job ? `Job: ${p.job.job} ▾` : 'Set job ▾'}
          </button>
          {open === 'job' && (
            <div className="menubar-popover">
              <JobControl job={p.job} onSet={(j, t) => { close(); p.onSetJob(j, t); }} />
            </div>
          )}
        </span>
      )}
    </div>
  );
};

export default MenuBar;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/MenuBar.test.tsx`
Expected: PASS (7 tests). Note: the job popover test relies on `JobControl`'s existing placeholders (`Job id (e.g. PROJ-123)` and a `Set job` button) — these already exist.

- [ ] **Step 5: Add CSS to `src/specpad.less`**

```less
.menubar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #1f2d3d;
  color: #e8eef5;
  border-radius: 4px;
  margin-bottom: 14px;
  position: relative;
}
.menubar-brand { font-size: 15px; font-weight: 700; letter-spacing: .3px; }
.menubar-project { opacity: .9; }
.menubar-spacer { flex: 1; }
.menubar-dropdown { position: relative; display: inline-block; }
.menubar .menubar-chip {
  background: transparent;
  color: #e8eef5;
  border: 1px solid #41597a;
  border-radius: 4px;
  padding: 3px 9px;
  font-size: 13px;
}
.menubar .menubar-chip:disabled { opacity: .5; }
.menubar-menu {
  position: absolute; top: 100%; left: 0; z-index: 1050; margin-top: 4px;
  list-style: none; padding: 4px 0; min-width: 200px;
  background: #fff; color: #333; border: 1px solid #ccc; border-radius: 4px;
  box-shadow: 0 6px 14px rgba(0,0,0,.18);
}
.menubar-menu li:hover { background: #f0f8ff; }
.menubar-popover {
  position: absolute; top: 100%; right: 0; z-index: 1050; margin-top: 4px;
  background: #fff; color: #333; border: 1px solid #ccc; border-radius: 4px;
  box-shadow: 0 6px 14px rgba(0,0,0,.18); padding: 10px;
}
.menubar-backdrop { position: fixed; inset: 0; z-index: 1040; }
```

- [ ] **Step 6: Typecheck + lint + full suite**

Run: `npx tsc --noEmit` — clean. `npm run lint` — clean. `npm test` — all green.

- [ ] **Step 7: Commit**

```bash
git add src/components/MenuBar.tsx src/components/__tests__/MenuBar.test.tsx src/specpad.less
git commit -m "feat(editor): MenuBar (brand + project switcher, File menu, Save, Job chip)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Wire `MenuBar` into `LocalApp`

**Files:**
- Modify: `src/LocalApp.tsx`
- Test: `src/__tests__/LocalApp.test.tsx`

- [ ] **Step 1: Update the LocalApp test** in `src/__tests__/LocalApp.test.tsx`. The document-switch test currently uses the `<select>` combobox. The switcher is now the brand dropdown in the MenuBar. Update the switching interaction:
  - After opening the project, the two project names appear via the brand dropdown. Replace the `screen.findByRole('combobox')` + `fireEvent.change` flow with: click the brand trigger (`screen.getByText('AcmeApp')`-style — but note the mock project is named `AppA`/`AppB`), then click the target name.
  - Concretely, adapt to the fixture (projects `AppA`/`AppB`): after `fireEvent.click(screen.getByText('Open Project Directory'))` — wait, that button is gone too. The open now happens via File ▾ → Open project directory…. Rewrite the test to:
    ```tsx
    it('re-seeds the table when the selected document changes', async () => {
      render(<LocalApp />);
      fireEvent.click(screen.getByText('File ▾'));
      fireEvent.click(screen.getByText('Open project directory…'));
      // two projects, no auto-load → brand switcher lets you pick
      fireEvent.click(await screen.findByText('AppA'));   // brand trigger shows first/selected or placeholder
      fireEvent.click(await screen.findByText('AppB'));
      expect(await screen.findByText('Requirement B')).toBeInTheDocument();
      fireEvent.click(screen.getByText('AppB'));
      fireEvent.click(await screen.findByText('AppA'));
      expect(await screen.findByText('Requirement A')).toBeInTheDocument();
    });
    ```
    IMPORTANT: this depends on how `LocalApp` shows the switcher when no doc is auto-selected. If the brand shows a placeholder like "Select project ▾" until one is chosen, target that text instead. Implement `LocalApp` (Step 2+) first if needed, then finalize the exact query strings to match the rendered chrome — adjust the test to the real DOM, not the reverse.

- [ ] **Step 2: Import MenuBar** in `src/LocalApp.tsx`: `import MenuBar from './components/MenuBar';`

- [ ] **Step 3: Replace the `<header className="page-header">` block and the `<div className="toolbar">` block** with a single `<MenuBar>` render. Remove the `<h1>` brand, the open/new/change-dir buttons, the temporary Save button, and the document `<select>`. **Keep** the SRS/VTP/Testing view-switcher `btn-group` — move it into a thin toolbar row that remains below the MenuBar (Plan 3 turns it into tabs). The new top of the render becomes:

```tsx
      <MenuBar
        projectName={projectName}
        projectNames={uniqueDocNames}
        onSelectProject={handleSelectDocument}
        isDirectoryOpen={isDirectoryOpen}
        supportsFileSystemAccess={supportsFileSystemAccess}
        dirty={dirty}
        onSave={save}
        onNewDocument={handleNewDocument}
        onOpenDirectory={() => handleOpenProject(false)}
        onOpenProjectFile={() => handleOpenProject(true)}
        onOpenFallback={handleOpenFallback}
        job={job}
        onSetJob={handleSetJob}
      />

      {!supportsFileSystemAccess && (
        <div className="alert alert-warning">
          Your browser doesn't support the File System Access API. Use Chrome or Edge for full editing.
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
          <button type="button" className="close" onClick={() => setError(null)} aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      )}

      {(srsDoc || vtpDoc) && (
        <div className="toolbar" style={{ marginBottom: 16 }}>
          <div className="btn-group" role="group">
            <button className={`btn ${currentView === 'srs' ? 'btn-info' : 'btn-default'}`} disabled={!srsDoc} onClick={() => setCurrentView('srs')}>SRS</button>
            <button className={`btn ${currentView === 'vtp' ? 'btn-info' : 'btn-default'}`} disabled={!vtpDoc} onClick={() => setCurrentView('vtp')}>VTP</button>
            <button className={`btn ${currentView === 'testing' ? 'btn-info' : 'btn-default'}`} disabled={!vtpDoc} onClick={() => setCurrentView('testing')}>Testing</button>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Remove the inline `<JobControl>`** from the `change-tracking` block (the Job now lives in the MenuBar). Leave the `<VersionTimeline>` / degraded note as-is (Plan 3 replaces it). If removing `JobControl` leaves that block with only the timeline, keep the surrounding `{isDirectoryOpen && selectedDocName && (...)}` wrapper. Remove the now-unused `JobControl` import.

- [ ] **Step 5: Add Ctrl/Cmd-S and `beforeunload`.** Add an effect near the other effects in `LocalApp`:

```tsx
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (dirty) void save(); }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [dirty, save]);
```
(`save` is stable enough; if `react-hooks/exhaustive-deps` complains and `save` isn't memoized, wrap `save` in `useCallback` or add an eslint-disable line consistent with the file's existing effects, which already use `// eslint-disable-next-line react-hooks/exhaustive-deps`.)

- [ ] **Step 6: Confirm cleanup.** Run `grep -n "page-header\|>New Document<\|Change Directory\|JobControl" src/LocalApp.tsx` — expect no matches (all removed). The brand/title and those buttons now live in MenuBar.

- [ ] **Step 7: Full suite, typecheck, lint, build**

Run: `npm test` — all green (LocalApp test updated for the new chrome).
Run: `npx tsc --noEmit` — clean.
Run: `npm run lint` — clean.
Run: `npm run build` — clean.

- [ ] **Step 8: Commit**

```bash
git add src/LocalApp.tsx src/__tests__/LocalApp.test.tsx
git commit -m "feat(editor): mount MenuBar in LocalApp; retire header + toolbar buttons + inline job

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (design §3/§4/§6):**
- App name → MenuBar brand; project `<select>` → brand project switcher → Task 1 + Task 2. ✓
- New / Open / Change Directory → File menu. ✓
- Save in the bar with unsaved indicator (●) + Ctrl/Cmd-S + `beforeunload` → Task 1 Save + Task 2 effect. ✓
- Job control → MenuBar Job chip popover (reuses `JobControl`). ✓
- No-directory state → File offers Open; no Save until a dir is open. ✓
- Deferred to Plan 3 (noted): tabs (view switcher kept as buttons for now), status bar (ValidationPanel kept), version chip + dialog (VersionTimeline kept inline).

**2. Placeholder scan:** No TBD/TODO; complete component + tests + CSS + exact LocalApp edits + commands/expected results. The LocalApp-test query-string caveat is an explicit "match the real DOM" instruction, not a placeholder.

**3. Type/name consistency:** `MenuBarProps` callback names match the LocalApp handlers wired in Task 2 (`save`, `handleNewDocument`, `handleOpenProject(false/true)`, `handleOpenFallback`, `handleSelectDocument`, `handleSetJob`, `dirty`, `job`, `projectName`, `uniqueDocNames`). `JobControl`'s `onSet(job, title)` signature matches `onSetJob`.

---

## Out of scope (Plan 3)
- `ViewTabs` (replaces the SRS/VTP/Testing buttons), `StatusBar` (replaces `ValidationPanel`), `VersionHistoryDialog` + the menu-bar **version chip**, and the unsaved-changes guard on project/doc switch.
