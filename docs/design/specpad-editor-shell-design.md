# SpecPad — Editor Shell Redesign — Design

**Date:** 2026-06-09
**Status:** Approved for implementation
**Builds on:** the current editor (`src/LocalApp.tsx` + components) and the change-tracking /
SRS-editor features already shipped.

## 1. Purpose

The editor's top area has accreted: a big app-title header, a row of buttons (New Document, Change
Directory, Open, a document `<select>`, and an SRS/VTP/Testing button group), an always-on validation
panel, and an inline job + version-history block. This redesign consolidates that into a conventional
**application shell**: a menu bar, a tab strip for views, and a status bar — recovering vertical space
and giving each concern one clear home.

Validated via visual mockup. The six requested changes map to the shell as:

1. **App name** → menu-bar brand (left).
2. **New Document / Change Directory / Open** → a **File ▾** menu.
3. **Validation status** → **status-bar, bottom-right**; clickable to expand error/warning details.
4. **SRS / VTP / Testing** → a **tab strip**: *Requirements · Verification Tests · Results*,
   extensible (future *Architecture*, etc.).
5. **Version history** → a **version chip** (`v1.0 ▾`) in the menu bar that opens an on-demand dialog.
6. **Save / Open** → menu bar; the **Save** control shows an unsaved-changes indicator.

Plus (from review): the **Job** control moves to the menu bar; validation is shown **only** in the
status bar (removed from the menu bar).

## 2. The pivotal architectural change: lift editing state to the shell

Today each table (`SRSTable`/`VTPTable`/`TestingView`) holds its **own** working copy
(`useState(doc)`) and its **own** Save button, so "unsaved changes" is trapped inside the table. A
menu-bar Save with a dirty indicator (#6) requires that state at the shell level.

**Decision: make the tables controlled.** Lift the working document and the dirty flag into
`LocalApp`:

- `LocalApp` owns, per open document, a **saved** copy (what's on disk) and a **working** copy (live
  edits). `dirty = working ≠ saved` (structural compare, or a simple changed-since-load flag).
- Tables receive `doc={working}` + `onChange={(next) => setWorking(next)}` and **no longer render
  their own Save button** or seed their own `data` state. Their internal UI state (which cell is
  editing, expanded rows, open menu/modal) stays local — only the *document* lifts.
- The menu bar's **Save** calls `LocalApp`'s save (writes working → disk, sets saved = working,
  clears dirty). The indicator reflects `dirty`.

This is the one substantial refactor; everything else is additive shell components.

Considered alternative (rejected): keep tables uncontrolled and expose dirty/save via an imperative
handle (`ref`) the menu bar calls. Works, but spreads save logic across refs and is harder to test;
controlled tables are cleaner and make an unsaved-changes guard (see §6) trivial.

## 3. Components

Small, presentational where possible; `LocalApp` stays the orchestrator holding state.

- **`MenuBar`** (`src/components/MenuBar.tsx`) — the dark top bar:
  - **Brand:** `▣ SpecPad / <project>` where `<project>` is a dropdown to switch among project names
    in the open directory (replaces the document `<select>`); shown as plain text when there's only
    one.
  - **File ▾** menu: New document… · Open project… · Change directory… · (Recent ▸ when available).
    In the no–File-System-Access fallback, this menu offers Open/Download via the existing fallback
    paths.
  - **Save** button with a **dirty dot** (●) when `dirty`; disabled when clean. Ctrl/Cmd-S triggers it.
  - **Job chip** (`Job: PROJ-123 ▾`) opening a small popover to set/clear the current job (the current
    `JobControl`, recomposed as a popover). Shows "Set job" when none.
  - **Version chip** (`v1.0 ▾`) opening the version-history dialog; shows the manifest `baseline`
    version, or is hidden when there's no manifest.
- **`ViewTabs`** (`src/components/ViewTabs.tsx`) — the tab strip. Driven by a small **registry** array
  `[{ key:'srs', label:'Requirements', enabled }, { key:'vtp', label:'Verification Tests', enabled },
  { key:'testing', label:'Results', enabled }]` so a future *Architecture* tab is one entry. Tabs are
  disabled when their doc is absent; the active tab is highlighted.
- **`StatusBar`** (`src/components/StatusBar.tsx`) — the footer: doc path on the left; a validation
  summary on the **right**. Computes `validate` + `checkGovernance` (the same shared module
  `ValidationPanel` used) and shows:
  - clean → green `✓ No problems found`;
  - problems → red `⚠ N errors · M warnings`, clickable to expand an inline details list (the messages
    the old panel showed). `ValidationPanel` is retired; its logic moves here.
- **`VersionHistoryDialog`** (`src/components/VersionHistoryDialog.tsx`) — a modal wrapping the
  existing `VersionTimeline` (release list, baseline marker), opened from the version chip. The inline
  timeline block is removed from the main flow.

`ItemInfo`'s modal/backdrop pattern is the reuse model for the dialog and popovers.

## 4. Layout & states

```
┌───────────────────────────────────────────────────────────────────────┐
│ ▣ SpecPad / AcmeApp ▾   File ▾   💾 Save ●            Job: PROJ-123 ▾  v1.0 ▾ │  MenuBar
├───────────────────────────────────────────────────────────────────────┤
│ [Requirements] Verification Tests  Results   ＋Architecture…           │  ViewTabs
├───────────────────────────────────────────────────────────────────────┤
│ (active view: SRSTable / VTPTable / TestingView)                        │  content
├───────────────────────────────────────────────────────────────────────┤
│ docs/specpad/AcmeApp                                ✓ No problems found │  StatusBar
└───────────────────────────────────────────────────────────────────────┘
```

- **No directory open:** MenuBar shows brand + **File ▾** (Open…); a centered welcome/recent-projects
  panel in the content area (today's behavior). No tabs, no status bar.
- **Directory open, no doc selected:** MenuBar brand project-switcher populated; tabs disabled; status
  bar shows the path. (Auto-selects when there's a single project, as today.)
- **Doc open:** full shell as drawn.
- **Loading / errors:** a transient inline notice in the content area (today's `loading`/`error`
  alerts), unchanged.

## 5. What is removed / replaced

- `header.page-header` (the big `<h1>`) → MenuBar brand.
- `.toolbar` button cluster + document `<select>` → File menu + brand project-switcher + tabs.
- `<ValidationPanel>` (always-on box) → StatusBar summary + expandable details.
- Inline `<JobControl>` → Job chip popover in the MenuBar.
- Inline `<VersionTimeline>` block + degraded note → version chip → `VersionHistoryDialog`; the
  "history unavailable — run `specpad refresh`" message becomes the dialog's empty state.
- Per-table **Save** buttons → single menu-bar Save (state lifted, §2).

## 6. Behaviors & error handling

- **Dirty tracking:** editing any table updates the working copy → `dirty=true`; Save persists and
  clears it. The browser `beforeunload` warns on unsaved changes.
- **Unsaved-changes guard:** switching project (brand dropdown) or document with unsaved edits prompts
  *Save / Discard / Cancel*. (Switching *tabs* within the same project does not discard — all open
  docs share the lifted working state.)
- **Save fallback:** no File System Access API → Save downloads the file (existing
  `saveFileFallback`); the dirty indicator still works.
- **Validation details:** clicking the status summary toggles an inline panel of messages; each names
  the offending item id (as today). Non-blocking — purely informational.
- **Version chip absent** when no `releases.json`; **Job chip** shows "Set job" when no marker.
- **Keyboard:** Ctrl/Cmd-S = Save (prevents the browser's native save dialog).

## 7. Components & decomposition (for the implementation plans)

Likely **three plans**:

1. **Lift editing state** — make `SRSTable`/`VTPTable`/`TestingView` controlled (`doc` + `onChange`,
   drop internal Save + `data` seeding); `LocalApp` owns working/saved/dirty + a single `save()`.
   No visual change yet (a temporary Save button can live where the old ones were until Plan 2).
2. **MenuBar** — brand + project switcher, File menu, Save+dirty (+Ctrl-S, beforeunload), Job chip
   popover, version chip; wire into `LocalApp`; retire `.toolbar` and the page-header.
3. **ViewTabs + StatusBar + VersionHistoryDialog** — tab registry, validation summary/details
   (retire `ValidationPanel`), the version dialog (retire the inline timeline), unsaved-changes guard.

## 8. Testing

- **Controlled tables:** editing calls `onChange` with the updated doc; no internal Save; round-trips
  preserve ids. `LocalApp`: edit → `dirty` true; save → persisted + `dirty` false.
- **MenuBar:** File menu items fire the right handlers; Save disabled when clean, enabled + dotted when
  dirty; Ctrl-S triggers save; Job chip popover sets the job; version chip opens the dialog.
- **ViewTabs:** active highlight; disabled when a doc is absent; switching changes the view.
- **StatusBar:** clean → "No problems"; with seeded violations → counts + expandable details (same
  assertions `ValidationPanel.test` made, relocated).
- **VersionHistoryDialog:** renders the manifest timeline; empty state when no manifest.
- **Unsaved guard:** switching project/doc while dirty prompts; Cancel aborts.
- Existing `LocalApp.test` (document switching) updated for the new chrome.

## 9. Explicitly deferred (YAGNI / non-goals)

- A real *Architecture* (or other) document type — only the **tab registry** is built so it slots in
  later; no new doc type now.
- Per-tab independent dirty state / multi-document tabs beyond the current srs/vtp/testing-of-one-project model.
- Theming/visual polish beyond matching the current Bootstrap-3 look.
- Command palette, keyboard shortcuts beyond Ctrl-S.
- VTPTable Word-style redline (tracked separately from the SRS-editor feature).
