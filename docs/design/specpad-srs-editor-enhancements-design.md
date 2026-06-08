# SpecPad — SRS Editor Enhancements + Hierarchy — Design

**Date:** 2026-06-08
**Status:** Approved for implementation
**Builds on:** `docs/design/specpad-v1-design.md` (contract/runtime) and
`docs/design/specpad-change-tracking-design.md` (redline/attribution this revises the rendering of).

## 1. Purpose

Improve the SRS editing experience and introduce lightweight **hierarchy** to requirements. Five
user-requested changes, plus a co-governed skill update so Claude creates hierarchical requirements
when appropriate:

1. Replace per-row action buttons with a **hamburger menu** (delete w/ confirm, add above/below/child,
   add heading, view information, move = drag/drop, indent/outdent).
2. A per-requirement **"Show tests"** toggle that reveals its verifying tests inline.
3. **Remove the Hazards column** (keep the data).
4. **Word-style redline** — show changes vs the current release in red/strikethrough.
5. **Heading codes show a dotted path** (e.g. `Data`, `Data.Range`) instead of the literal "heading".
6. **Skill update** — teach `SKILL.md` about hierarchical requirements so Claude authors them when a
   spec naturally has sections/sub-requirements.

## 2. Contract change (shared) — the one schema touch

Add a single optional field **`level?: number`** (indent depth; absent ⇒ 0) to `SrsItem` and `VtpItem`
in `src/shared/schema.ts`, and to the SRS/VTP JSON Schemas as `{ "type": "integer", "minimum": 0 }`.

- **Additive and optional ⇒ stays `schemaVersion: "1.0"`** (no `/v02/` build; old files still valid).
- The id-keyed diff is unaffected: indent/outdent surfaces as a `level` field change on a `modified`
  item. Governance (traceability / referential-integrity / missing-expected) is unchanged.
- `createSrsItem(existingIds, level?)` / `createVtpItem(existingIds, level?)` gain an optional level
  (default 0) so the skill and editor stamp depth at creation.

This is added to **both** item types for contract symmetry (both can have headings). The editor UI in
this iteration wires hierarchy for the **SRS** table; VTP consumes `level` later.

## 3. Hierarchy & derived heading codes (#5)

A flat, ordered `items` array stays the on-disk shape; `level` gives each item a depth. Hierarchy is a
**view concern derived from order + level**, not stored as a tree.

- **New pure module `src/outline.ts`** (unit-tested), exporting `deriveHeadingCodes(items)` →
  `Map<itemId, string>`. Algorithm: walk items in order keeping a stack of the most recent heading
  `code` segment per level; for each heading at level L, its dotted code = the ancestor heading
  segments (nearest preceding heading at each level < L) joined with `.` plus its own segment.
  - A heading's **segment** is its own `code` (editable; you type "Data", "Range"). If a heading has
    no `code`, fall back to its `text` slugged to a short token, so the path is never empty.
  - Requirements keep their **free-form `code`** (DOC-1, CT-3) — they are not renumbered.
- The SRS table renders the **derived dotted code** in a heading row's Code cell (replacing the
  literal "heading"), and indents every row by `level` (e.g. `paddingLeft: level * 1.5em`).

## 4. Per-row hamburger menu (#1) — SRS rows

Replace the four-button action cell with a single **⋮ menu** — a small dropdown component
`src/components/RowMenu.tsx` (Bootstrap-3 dropdown markup; closes on outside-click/Escape). Items:

- **Add requirement ▸** Above · Below · Child (Child = inserted below at `level + 1`)
- **Add heading** (inserted below at the same level)
- **Indent** / **Outdent** (`level ± 1`, clamped ≥ 0)
- **Move** — enters drag/drop reorder mode (see §8)
- **Delete** — always confirms (`confirm('Delete this requirement?')`)
- **View information** — opens the info modal (§6)

**Scope:** SRS rows get the hamburger this iteration; the VTP table keeps its existing buttons (a
follow-up will unify it).

## 5. Show tests (#2)

Each non-heading SRS requirement row gets a **"Show tests" toggle**. When expanded, a read-only
sub-row beneath it lists the requirement's verifying VTP tests — found by matching `vtpDoc` items whose
`verifies` includes the requirement `id` — showing `code · text · expected · result`. The redline
treatment (§7) applies to a listed test if it changed. Read-only here; editing tests stays in the VTP
view.

## 6. View information modal (#1)

A read-only modal `src/components/ItemInfo.tsx` showing the item's metadata: `id`, derived code,
`level`, `tags`, **`hazards`** (its new home now the column is gone), attribution
(added / last-changed / author from the change-tracking attribution map, when available), and the
verifying-test count. Editing these fields is deferred.

## 7. Word-style redline rendering (#4) — both tables

Replace the current green-row / yellow-cell / separate-removed-panel rendering with **track-changes
presentation** driven by a new pure helper.

- **New pure function `buildRedlineRows(baseline, working)`** in `src/changeTracking.ts` (unit-tested):
  returns an ordered list of display rows, each `{ item, status, changedFields? }` where status is
  `unchanged | added | modified | removed`. `removed` rows are taken from the **baseline** and
  interleaved at their baseline-relative position (after the working row that preceded them in the
  baseline); all other rows come from the working doc in working order.
- Rendering:
  - **added** → green text / left-accent, optional underline (insertion).
  - **removed** → **red + strikethrough**, rendered inline at position, **non-editable** (no menu,
    no inline edit).
  - **modified** → the changed field(s) marked (amber accent), per existing `changedFields`.
  - **unchanged** → normal.
- This supersedes the `ct-removed` panel and the `tr.success`/`tr.warning` row classes from the
  change-tracking design's editor section; attribution/timeline/job-control are untouched.
- Word-level (within-text) diffing remains **deferred**.

## 8. Move / drag-drop (#1)

Choosing **Move** puts the row into a drag handle state; dragging reorders the item within the list
(updating array order on drop). **Depth changes are not done by dragging** in this version — use
Indent/Outdent. Re-parent-by-horizontal-drag is deferred. Removed (redline) rows are not draggable.

## 9. Remove Hazards column (#3)

Drop the Hazards column from `SRSTable`. The `hazards` field stays in the schema and data and is shown
(read-only) in the View-information modal (§6). Hazard editing is deferred.

## 10. Skill update (#6) — co-governed hierarchy guidance

Update `skill/specpad/SKILL.md` so the skill (and Claude) understand hierarchy:

- Document the optional **`level`** field (indent depth, default 0) on SRS/VTP items.
- Document **dotted heading codes**: a heading's `code` is a short segment; its displayed code is the
  ancestor path joined by `.` (Data → Data.Range). Requirements keep free-form codes.
- **Guidance:** when a spec naturally has sections and sub-requirements, Claude should create
  **hierarchical** requirements — headings for sections (with short `code` segments) and `level` to
  nest requirements/sub-headings — rather than a flat list. Keep it shallow and meaningful; don't
  over-nest.
- Extend `skill/__tests__/change-tracking.test.ts` (or the parity test) to assert `SKILL.md` documents
  `level` and dotted heading codes, keeping skill ↔ contract in sync.

## 11. Components & decomposition

`SRSTable` is already busy; this design keeps files focused by extracting:

- `src/outline.ts` — pure `deriveHeadingCodes` (+ indent helpers).
- `src/changeTracking.ts` — add pure `buildRedlineRows` beside `buildRedline`.
- `src/components/RowMenu.tsx` — the per-row dropdown.
- `src/components/ItemInfo.tsx` — the info modal.
- `SRSTable.tsx` — orchestrator: renders redline rows, indentation, derived heading codes, the menu,
  the show-tests expander; no longer owns the Hazards column or the button cluster.
- `src/specpad.less` — indent, track-changes (added/removed/modified), menu, modal, show-tests styles.

Likely **four implementation plans**: (1) contract `level` + `outline.ts` + `buildRedlineRows` +
skill update (the shared/contract layer); (2) `RowMenu` + `ItemInfo` components; (3) `SRSTable` rewrite
wiring hierarchy, menu, show-tests, hazards removal; (4) redline rendering + CSS across the tables.

## 12. Error handling & edge cases

- **Indent with no valid parent** (first item, or indenting past depth+1): clamp so an item's level is
  at most one deeper than the preceding item; never produce an orphan jump (`level` can only increase
  by 1 relative to the row above).
- **Outdent at level 0:** no-op.
- **Heading with empty `code`:** dotted path falls back to a slug of its text so the path is non-empty.
- **Delete a heading with descendants:** confirm wording notes affected children; children keep their
  `level` (they re-associate with the previous heading) — no cascading delete in v1.
- **Removed (redline) rows:** never editable, never draggable, excluded from the menu.
- **Reorder across the baseline:** redline still diffs by id, so a moved item is `unchanged` (or
  `modified` only if a field changed), not add/remove churn.

## 13. Testing

- **Contract:** `level` validates (present/absent/0/positive; non-integer rejected); `createSrsItem`
  stamps the requested level.
- **`outline.ts`:** dotted codes for nested headings; fallback when a heading has no code; requirements
  excluded; reordering changes paths correctly.
- **`buildRedlineRows`:** added/modified/unchanged ordering; removed rows interleaved at baseline
  position; null baseline ⇒ all unchanged.
- **`RowMenu` / `ItemInfo`:** menu items fire the right callbacks; modal shows the metadata.
- **`SRSTable`:** indentation by level; heading shows dotted code (not "heading"); no Hazards column;
  show-tests reveals matching verifying tests; removed rows render struck-through and non-editable;
  add-child inserts at level+1; delete confirms.
- **Skill:** `SKILL.md` documents `level` + dotted codes (parity/doc test).
- **Dogfood:** SpecPad's own `docs/specpad/` stays valid/governance-clean; optionally adopt `level` to
  exercise hierarchy.

## 14. Explicitly deferred

- Word-level (within-text) inline diffing.
- Re-parent by horizontal drag (Indent/Outdent only).
- Hamburger menu on the VTP table (SRS only this iteration).
- Editing tags/hazards/attribution from the info modal (read-only for now).
- Cascading delete of a heading's descendants.
