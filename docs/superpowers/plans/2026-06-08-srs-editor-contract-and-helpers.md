# SRS Editor — Plan 1: Contract (`level`) + Pure Helpers + Skill Update

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the shared foundation for the SRS editor enhancements: the additive `level` field, a pure `deriveHeadingCodes` (dotted heading paths), a pure `buildRedlineRows` (Word-style interleaved redline), and the SKILL.md hierarchy guidance — all testable with no UI.

**Architecture:** One additive optional field (`level`) on SRS/VTP items keeps the schema at `1.0`. Two new pure functions (one new module `src/outline.ts`, one addition to `src/changeTracking.ts`) turn the flat-array-plus-level into derived heading codes and an ordered redline row list. The skill is updated in prose so it authors hierarchical requirements. No React in this plan.

**Tech Stack:** TypeScript, Ajv, Vitest. No new dependencies.

**Source design:** `docs/design/specpad-srs-editor-enhancements-design.md` — §2 (`level`), §3 (heading codes), §7 (`buildRedlineRows`), §10 (skill update).

---

## File Structure

- **Modify** `src/shared/schema.ts` — add `level?: number` to `SrsItem`/`VtpItem` and `level: {type:'integer',minimum:0}` to both item schemas.
- **Modify** `src/shared/factories.ts` — `createSrsItem`/`createVtpItem` accept an optional `level`.
- **Create** `src/shared/__tests__/level.test.ts` — validates the field + factory behavior.
- **Create** `src/outline.ts` — pure `deriveHeadingCodes(items)`.
- **Create** `src/__tests__/outline.test.ts`.
- **Modify** `src/changeTracking.ts` — add pure `buildRedlineRows(baseline, working)` + `RedlineRow`/`RowStatus`.
- **Modify** `src/__tests__/changeTracking.test.ts` — append `buildRedlineRows` tests.
- **Modify** `skill/specpad/SKILL.md` — document hierarchy (`level`, dotted heading codes) + guidance.
- **Modify** `skill/__tests__/change-tracking.test.ts` — assert SKILL.md documents `level` + dotted codes.

---

## Task 1: Add the `level` field to the contract

**Files:**
- Modify: `src/shared/schema.ts`
- Modify: `src/shared/factories.ts`
- Test: `src/shared/__tests__/level.test.ts` (create)

- [ ] **Step 1: Write the failing test — create `src/shared/__tests__/level.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import { createSrsItem, createVtpItem } from '../factories';
import type { SrsDoc } from '../schema';

function srsWith(items: SrsDoc['items']): SrsDoc {
  return { schemaVersion: '1.0', type: 'srs', name: 'A', title: 'T', items };
}

describe('level field', () => {
  it('accepts an item with a non-negative integer level', () => {
    expect(validate(srsWith([{ id: 'r_1', text: 'x', level: 2 }]))).toEqual([]);
  });
  it('accepts an item with no level (defaults to flat)', () => {
    expect(validate(srsWith([{ id: 'r_1', text: 'x' }]))).toEqual([]);
  });
  it('rejects a non-integer level', () => {
    expect(validate(srsWith([{ id: 'r_1', text: 'x', level: 1.5 } as never])).length).toBeGreaterThan(0);
  });
  it('rejects a negative level', () => {
    expect(validate(srsWith([{ id: 'r_1', text: 'x', level: -1 } as never])).length).toBeGreaterThan(0);
  });

  it('createSrsItem omits level by default and sets it when > 0', () => {
    expect(createSrsItem([]).level).toBeUndefined();
    expect(createSrsItem([], 2).level).toBe(2);
  });
  it('createVtpItem sets level when > 0', () => {
    expect(createVtpItem([]).level).toBeUndefined();
    expect(createVtpItem([], 1).level).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/shared/__tests__/level.test.ts`
Expected: FAIL — `level` is not a known property type (factory has no level param; schema may accept it loosely, so the integer/negative cases are what should fail first).

- [ ] **Step 3: Add `level` to the interfaces in `src/shared/schema.ts`**

Add `level?: number;` after `heading?: boolean;` in BOTH `SrsItem` and `VtpItem`. (Use `replace_all` since both interfaces share the exact line.)

Old (appears twice):
```ts
  heading?: boolean;
```
New (both):
```ts
  heading?: boolean;
  level?: number;
```

- [ ] **Step 4: Add `level` to both item JSON Schemas in `src/shared/schema.ts`**

In `srsSchema` AND `vtpSchema`, the item `properties` contains the line `heading: { type: 'boolean' },`. Add a `level` line after it. (Use `replace_all` — both schemas share the exact line.)

Old (appears twice):
```ts
          heading: { type: 'boolean' },
```
New (both):
```ts
          heading: { type: 'boolean' },
          level: { type: 'integer', minimum: 0 },
```

- [ ] **Step 5: Update the factories in `src/shared/factories.ts`**

Replace `createSrsItem` and `createVtpItem` with level-aware versions:

```ts
export function createSrsItem(existingIds: Iterable<string>, level = 0): SrsItem {
  const item: SrsItem = { id: generateId(ID_PREFIX.requirement, existingIds), text: '' };
  if (level > 0) item.level = level;
  return item;
}

export function createVtpItem(existingIds: Iterable<string>, level = 0): VtpItem {
  const item: VtpItem = {
    id: generateId(ID_PREFIX.test, existingIds),
    text: '',
    verifies: [],
    expected: '',
    result: '',
  };
  if (level > 0) item.level = level;
  return item;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/shared/__tests__/level.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Full suite + typecheck + lint**

Run: `npm test` — all green (existing factory/schema tests still pass).
Run: `npx tsc --noEmit` — clean.
Run: `npm run lint` — clean.

- [ ] **Step 8: Commit**

```bash
git add src/shared/schema.ts src/shared/factories.ts src/shared/__tests__/level.test.ts
git commit -m "feat(shared): add optional level field for requirement hierarchy

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `deriveHeadingCodes` — dotted heading paths

**Files:**
- Create: `src/outline.ts`
- Test: `src/__tests__/outline.test.ts`

- [ ] **Step 1: Write the failing test — create `src/__tests__/outline.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { deriveHeadingCodes } from '../outline';
import type { SrsItem } from '../shared';

const h = (id: string, text: string, level: number, code?: string): SrsItem => ({
  id, text, heading: true, level, ...(code ? { code } : {}),
});
const r = (id: string, level = 0): SrsItem => ({ id, text: 'req', level });

describe('deriveHeadingCodes', () => {
  it('uses a heading code segment at the top level', () => {
    const m = deriveHeadingCodes([h('h1', 'Data section', 0, 'Data')]);
    expect(m.get('h1')).toBe('Data');
  });

  it('joins ancestor segments with dots for nested headings', () => {
    const m = deriveHeadingCodes([
      h('h1', 'Data', 0, 'Data'),
      h('h2', 'Range', 1, 'Range'),
    ]);
    expect(m.get('h1')).toBe('Data');
    expect(m.get('h2')).toBe('Data.Range');
  });

  it('pops the stack when returning to a shallower level', () => {
    const m = deriveHeadingCodes([
      h('h1', 'Data', 0, 'Data'),
      h('h2', 'Range', 1, 'Range'),
      h('h3', 'Other', 0, 'Other'),
    ]);
    expect(m.get('h3')).toBe('Other');
  });

  it('falls back to the first word of the text when a heading has no code', () => {
    const m = deriveHeadingCodes([h('h1', 'Stable identity and references', 0)]);
    expect(m.get('h1')).toBe('Stable');
  });

  it('ignores non-heading requirements', () => {
    const m = deriveHeadingCodes([h('h1', 'Data', 0, 'Data'), r('r1', 1)]);
    expect(m.has('r1')).toBe(false);
    expect(m.size).toBe(1);
  });

  it('treats a missing level as 0', () => {
    const m = deriveHeadingCodes([
      { id: 'h1', text: 'Data', heading: true, code: 'Data' },
      { id: 'h2', text: 'More', heading: true, code: 'More' },
    ]);
    expect(m.get('h2')).toBe('More');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/outline.test.ts`
Expected: FAIL — cannot resolve `../outline`.

- [ ] **Step 3: Implement — create `src/outline.ts`**

```ts
/**
 * outline — derive dotted heading codes from the flat items + their `level`.
 * A heading's displayed code is the dot-joined chain of ancestor heading segments
 * plus its own. A segment is the heading's `code`, or the first word of its text.
 * Pure; requirements (non-headings) are not assigned codes here.
 */
import type { SrsItem } from './shared';

function slugSegment(text: string): string {
  const first = text.trim().split(/\s+/)[0];
  return first || 'section';
}

export function deriveHeadingCodes(items: SrsItem[]): Map<string, string> {
  const codes = new Map<string, string>();
  const stack: { level: number; segment: string }[] = [];
  for (const item of items) {
    if (!item.heading) continue;
    const level = item.level ?? 0;
    while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
    const segment = item.code?.trim() || slugSegment(item.text);
    const dotted = [...stack.map((s) => s.segment), segment].join('.');
    codes.set(item.id, dotted);
    stack.push({ level, segment });
  }
  return codes;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/outline.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` — clean. Run: `npm run lint` — clean.

- [ ] **Step 6: Commit**

```bash
git add src/outline.ts src/__tests__/outline.test.ts
git commit -m "feat(editor): derive dotted heading codes from level hierarchy

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `buildRedlineRows` — Word-style interleaved redline

**Files:**
- Modify: `src/changeTracking.ts`
- Test: `src/__tests__/changeTracking.test.ts`

- [ ] **Step 1: Write the failing test — append to `src/__tests__/changeTracking.test.ts`**

```ts
import { buildRedlineRows } from '../changeTracking';

describe('buildRedlineRows', () => {
  const base = (items: SrsItem[]): SrsDoc => ({ schemaVersion: '1.0', type: 'srs', name: 'A', title: 'T', items });

  it('marks all rows unchanged when there is no baseline', () => {
    const rows = buildRedlineRows(null, base([{ id: 'r_1', text: 'A' }]));
    expect(rows.map((r) => r.status)).toEqual(['unchanged']);
  });

  it('tags added and modified rows in working order', () => {
    const baseline = base([{ id: 'r_1', text: 'A' }]);
    const working = base([{ id: 'r_1', text: 'A2' }, { id: 'r_2', text: 'B' }]);
    const rows = buildRedlineRows(baseline, working);
    expect(rows.map((r) => [r.item.id, r.status])).toEqual([['r_1', 'modified'], ['r_2', 'added']]);
    expect(rows[0].changedFields).toEqual(['text']);
  });

  it('interleaves a removed row at its baseline position', () => {
    const baseline = base([{ id: 'r_1', text: 'A' }, { id: 'r_2', text: 'B' }, { id: 'r_3', text: 'C' }]);
    const working = base([{ id: 'r_1', text: 'A' }, { id: 'r_3', text: 'C' }]); // r_2 removed
    const rows = buildRedlineRows(baseline, working);
    expect(rows.map((r) => [r.item.id, r.status])).toEqual([
      ['r_1', 'unchanged'],
      ['r_2', 'removed'],
      ['r_3', 'unchanged'],
    ]);
  });

  it('places a removed first item before everything', () => {
    const baseline = base([{ id: 'r_1', text: 'A' }, { id: 'r_2', text: 'B' }]);
    const working = base([{ id: 'r_2', text: 'B' }]); // r_1 removed
    const rows = buildRedlineRows(baseline, working);
    expect(rows.map((r) => [r.item.id, r.status])).toEqual([['r_1', 'removed'], ['r_2', 'unchanged']]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/changeTracking.test.ts`
Expected: FAIL — `buildRedlineRows` is not exported.

- [ ] **Step 3: Implement — append to `src/changeTracking.ts`** (after `computeAttribution`)

```ts
export type RowStatus = 'unchanged' | 'added' | 'modified' | 'removed';

export interface RedlineRow {
  item: AnyItem;
  status: RowStatus;
  changedFields?: string[];
}

/**
 * Ordered display rows for a Word-style redline: working items in order (tagged
 * added/modified/unchanged), with baseline-only items spliced in as `removed` at
 * their baseline position — right after their nearest surviving predecessor.
 */
export function buildRedlineRows(baseline: AnyDoc | null, working: AnyDoc): RedlineRow[] {
  if (!baseline) return working.items.map((item) => ({ item, status: 'unchanged' as RowStatus }));

  const diff = diffDocs(baseline, working);
  const added = new Set(diff.added.map((c) => c.id));
  const modified = new Map(diff.modified.map((c) => [c.id, c.changedFields]));
  const removedIds = new Set(diff.removed.map((c) => c.id));

  const START = ' start';
  const removedAfter = new Map<string, AnyItem[]>();
  let predecessor = START;
  for (const item of baseline.items) {
    if (removedIds.has(item.id)) {
      const list = removedAfter.get(predecessor) ?? [];
      list.push(item);
      removedAfter.set(predecessor, list);
    } else {
      predecessor = item.id;
    }
  }

  const out: RedlineRow[] = [];
  for (const r of removedAfter.get(START) ?? []) out.push({ item: r, status: 'removed' });
  for (const item of working.items) {
    if (added.has(item.id)) {
      out.push({ item, status: 'added' });
    } else if (modified.has(item.id)) {
      out.push({ item, status: 'modified', changedFields: modified.get(item.id) });
    } else {
      out.push({ item, status: 'unchanged' });
    }
    for (const r of removedAfter.get(item.id) ?? []) out.push({ item: r, status: 'removed' });
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/changeTracking.test.ts`
Expected: PASS (existing changeTracking tests + 4 new).

- [ ] **Step 5: Full suite + typecheck + lint**

Run: `npm test` — all green. Run: `npx tsc --noEmit` — clean. Run: `npm run lint` — clean.

- [ ] **Step 6: Commit**

```bash
git add src/changeTracking.ts src/__tests__/changeTracking.test.ts
git commit -m "feat(editor): buildRedlineRows for Word-style interleaved redline

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: SKILL.md hierarchy guidance + parity test

**Files:**
- Modify: `skill/specpad/SKILL.md`
- Test: `skill/__tests__/change-tracking.test.ts`

- [ ] **Step 1: Add a failing assertion — append a describe block to `skill/__tests__/change-tracking.test.ts`**

(The file already reads `skill` = SKILL.md via `readFileSync`. Add this block at the end.)

```ts
describe('skill documents requirement hierarchy', () => {
  it('documents the level field and dotted heading codes', () => {
    expect(skill).toMatch(/level/);
    expect(skill).toMatch(/hierarch/i);
    expect(skill).toContain('Data.Range');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run skill/__tests__/change-tracking.test.ts`
Expected: FAIL — SKILL.md does not yet mention hierarchy / `Data.Range`.

- [ ] **Step 3: Add a "Hierarchy" section to `skill/specpad/SKILL.md`**

Insert this section immediately AFTER the "## The v1 shape" section and BEFORE the "## Stable ids (critical)" section:

```markdown
## Hierarchy (sections and sub-requirements)

Items are a flat, ordered array, but each SRS/VTP item may carry an optional **`level`** (an integer
indent depth; absent means 0). Use `level` to nest: a sub-heading or a child requirement sits one
level deeper than its parent.

- **Headings form sections.** A heading's `code` is a short segment (e.g. `Data`, `Range`). Its
  displayed code is the dotted path of ancestor heading segments plus its own — a heading `Range` at
  level 1 under a heading `Data` at level 0 displays as `Data.Range`. Requirements keep their own
  free-form `code` (e.g. `DOC-1`).
- **When to use it:** when a spec naturally has sections and sub-requirements, author it
  hierarchically — headings for sections with short `code` segments, and `level` to nest
  requirements and sub-headings — rather than a single flat list. Keep nesting shallow and
  meaningful; do not over-nest.
- `level` is additive and optional; files without it are still valid (everything is flat at level 0).
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run skill/__tests__/change-tracking.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite (incl. parity test) + lint**

Run: `npm test` — all green (existing `skill/__tests__/parity.test.ts` still passes).
Run: `npm run lint` — clean.

- [ ] **Step 6: Commit**

```bash
git add skill/specpad/SKILL.md skill/__tests__/change-tracking.test.ts
git commit -m "skill(specpad): document requirement hierarchy (level + dotted heading codes)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (against design §2/§3/§7/§10):**
- §2 `level` field on both items + schema + factories → Task 1. ✓
- §3 derived dotted heading codes (segment = code or text-slug; requirements excluded) → Task 2. ✓
- §7 `buildRedlineRows` interleaving removed at baseline position; null baseline ⇒ unchanged → Task 3. ✓
- §10 SKILL.md documents `level` + dotted codes + authoring guidance, with a parity/doc test → Task 4. ✓
- Out of scope here (later plans): RowMenu, ItemInfo, SRSTable rewrite, redline *rendering*/CSS.

**2. Placeholder scan:** No TBD/TODO. Every code step is complete; every test step has real assertions; every run step has an exact command + expected result.

**3. Type/name consistency:** `level?: number` matches the schema `integer/minimum:0`; `createSrsItem(ids, level?)`/`createVtpItem(ids, level?)` match their tests; `deriveHeadingCodes(items: SrsItem[]): Map<string,string>`; `buildRedlineRows(baseline: AnyDoc|null, working: AnyDoc): RedlineRow[]` with `RowStatus`/`RedlineRow` reuse the existing `AnyDoc`/`AnyItem` aliases and `diffDocs` in `changeTracking.ts`. The change-tracking test's `skill` binding and the changeTracking test's `SrsItem`/`SrsDoc` imports already exist in those files.

---

## Out of scope (later plans)
- **Plan 2:** `RowMenu` + `ItemInfo` presentational components.
- **Plan 3:** `SRSTable` rewrite — indentation, derived heading codes, the hamburger menu, show-tests, hazards-column removal.
- **Plan 4:** redline *rendering* via `buildRedlineRows` across the tables + CSS (supersedes the green-row/removed-panel styling).
