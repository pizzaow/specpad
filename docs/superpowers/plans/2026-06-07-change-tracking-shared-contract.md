# Change Tracking — Plan 1: Shared Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the pure, id-keyed semantic diff primitive and the three change-tracking sidecar document contracts (`releases`, `job`, `attribution`) to the shared module, fully unit-tested.

**Architecture:** Extend `src/shared/` (the contract both editor and skill obey) with: (1) sidecar types + JSON Schemas in `schema.ts`, registered in `validate.ts` so they validate structurally like the core docs; (2) a new pure `diff.ts` exporting `diffItems`/`diffDocs` keyed on the stable `id`, exported via the barrel `index.ts`. No git, no I/O, no schema change to the core `proj/srs/vtp` contract.

**Tech Stack:** TypeScript, Ajv (JSON Schema), Vitest. Plain ES modules, zero new dependencies.

**Source design:** `docs/design/specpad-change-tracking-design.md` (§3 sidecars, §5 diff primitive, §12 resolved decisions).

---

## File Structure

- **Modify** `src/shared/schema.ts` — append sidecar TypeScript types (`ReleasesDoc`, `JobDoc`, `AttributionDoc` + helpers) and their JSON Schema documents (`releasesSchema`, `jobSchema`, `attributionSchema`). Re-exported automatically by the barrel.
- **Modify** `src/shared/validate.ts` — register the three sidecar schemas in the `validators` map so `validate(doc)` dispatches on their `type`.
- **Create** `src/shared/diff.ts` — the pure diff primitive: `ChangeStatus`, `ItemChange<T>`, `DocDiff<T>`, `diffItems`, `diffDocs`.
- **Modify** `src/shared/index.ts` — add `export * from './diff';`.
- **Create** `src/shared/__tests__/diff.test.ts` — unit tests for the diff primitive.
- **Create** `src/shared/__tests__/sidecars.test.ts` — structural validation tests for the three sidecar schemas.

**Conventions to match (already in the repo):** schemas are `... as const` objects with `$id: 'specpad/v1/<type>'`; types use `SchemaVersion` from `schema.ts`; tests use Vitest `describe/it/expect` and inline fixture literals (see `governance.test.ts`).

---

## Task 1: Sidecar document contracts (types, schemas, validation)

**Files:**
- Modify: `src/shared/schema.ts` (append after the existing `vtpSchema` block, end of file)
- Modify: `src/shared/validate.ts:11-16` (the `validators` map and its import)
- Test: `src/shared/__tests__/sidecars.test.ts` (create)

- [ ] **Step 1: Append sidecar types + schemas to `schema.ts`**

Append to the end of `src/shared/schema.ts`:

```ts

// ---- Sidecar documents (change-tracking cache; see specpad-change-tracking-design.md) ----
// NOT part of the core proj/srs/vtp contract. Regenerable cache/config files.
// JSON Schema validates STRUCTURE ONLY, exactly like the core docs.

export type SidecarType = 'releases' | 'job' | 'attribution';

export interface ReleaseEntry {
  version: string;
  ref: string;
  date: string;
  snapshot: string | null; // path under docs/specpad/, or null if not yet cached
}

export interface ReleasesDoc {
  schemaVersion: SchemaVersion;
  type: 'releases';
  name: string;
  tagPattern: string;
  baseline: string | null; // version whose snapshot the baseline reflects
  releases: ReleaseEntry[];
}

export interface JobDoc {
  schemaVersion: SchemaVersion;
  type: 'job';
  job: string;
  title?: string;
}

export interface AuthorRef {
  name: string;
  email: string;
}

export interface AttributionEntry {
  addedIn: string;
  addedBy: AuthorRef;
  lastChangedIn: string;
  lastChangedBy: AuthorRef;
}

export interface AttributionDoc {
  schemaVersion: SchemaVersion;
  type: 'attribution';
  items: Record<string, AttributionEntry>;
}

export type SidecarDoc = ReleasesDoc | JobDoc | AttributionDoc;

const nullableString = { type: ['string', 'null'] } as const;

export const releasesSchema = {
  $id: 'specpad/v1/releases',
  type: 'object',
  required: ['schemaVersion', 'type', 'name', 'tagPattern', 'baseline', 'releases'],
  properties: {
    schemaVersion: { const: '1.0' },
    type: { const: 'releases' },
    name: { type: 'string' },
    tagPattern: { type: 'string' },
    baseline: nullableString,
    releases: {
      type: 'array',
      items: {
        type: 'object',
        required: ['version', 'ref', 'date', 'snapshot'],
        properties: {
          version: { type: 'string' },
          ref: { type: 'string' },
          date: { type: 'string' },
          snapshot: nullableString,
        },
      },
    },
  },
} as const;

export const jobSchema = {
  $id: 'specpad/v1/job',
  type: 'object',
  required: ['schemaVersion', 'type', 'job'],
  properties: {
    schemaVersion: { const: '1.0' },
    type: { const: 'job' },
    job: { type: 'string' },
    title: { type: 'string' },
  },
} as const;

const authorRefSchema = {
  type: 'object',
  required: ['name', 'email'],
  properties: { name: { type: 'string' }, email: { type: 'string' } },
} as const;

export const attributionSchema = {
  $id: 'specpad/v1/attribution',
  type: 'object',
  required: ['schemaVersion', 'type', 'items'],
  properties: {
    schemaVersion: { const: '1.0' },
    type: { const: 'attribution' },
    items: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['addedIn', 'addedBy', 'lastChangedIn', 'lastChangedBy'],
        properties: {
          addedIn: { type: 'string' },
          addedBy: authorRefSchema,
          lastChangedIn: { type: 'string' },
          lastChangedBy: authorRefSchema,
        },
      },
    },
  },
} as const;
```

- [ ] **Step 2: Register sidecar validators in `validate.ts`**

In `src/shared/validate.ts`, update the import on line 3 to include the new schemas:

```ts
import {
  projectSchema,
  srsSchema,
  vtpSchema,
  releasesSchema,
  jobSchema,
  attributionSchema,
} from './schema';
```

Then extend the `validators` map (currently lines 12-16) to:

```ts
const validators: Record<string, ValidateFunction> = {
  project: ajv.compile(projectSchema as object),
  srs: ajv.compile(srsSchema as object),
  vtp: ajv.compile(vtpSchema as object),
  releases: ajv.compile(releasesSchema as object),
  job: ajv.compile(jobSchema as object),
  attribution: ajv.compile(attributionSchema as object),
};
```

- [ ] **Step 3: Write the failing test**

Create `src/shared/__tests__/sidecars.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import type { ReleasesDoc, JobDoc, AttributionDoc } from '../schema';

const releases: ReleasesDoc = {
  schemaVersion: '1.0',
  type: 'releases',
  name: 'AcmeApp',
  tagPattern: 'v*',
  baseline: 'v26.1',
  releases: [
    { version: 'v24.0', ref: 'v24.0', date: '2025-11-02', snapshot: null },
    { version: 'v26.1', ref: 'v26.1', date: '2026-05-30', snapshot: '.specpad/baseline' },
  ],
};

const job: JobDoc = { schemaVersion: '1.0', type: 'job', job: 'PROJ-123', title: 'Add SSO' };

const attribution: AttributionDoc = {
  schemaVersion: '1.0',
  type: 'attribution',
  items: {
    r_7f3a9c: {
      addedIn: 'v24.0',
      addedBy: { name: 'Geoff Pollard', email: 'geoff@example.com' },
      lastChangedIn: 'v26.1',
      lastChangedBy: { name: 'Sam Lee', email: 'sam@example.com' },
    },
  },
};

describe('sidecar schemas', () => {
  it('accepts a well-formed releases doc', () => {
    expect(validate(releases)).toEqual([]);
  });

  it('accepts baseline: null (no releases yet)', () => {
    expect(validate({ ...releases, baseline: null, releases: [] })).toEqual([]);
  });

  it('rejects a releases doc missing tagPattern', () => {
    const { tagPattern, ...bad } = releases;
    expect(validate(bad).length).toBeGreaterThan(0);
  });

  it('accepts a well-formed job doc and one without a title', () => {
    expect(validate(job)).toEqual([]);
    expect(validate({ schemaVersion: '1.0', type: 'job', job: 'PROJ-9' })).toEqual([]);
  });

  it('rejects a job doc missing the job id', () => {
    expect(validate({ schemaVersion: '1.0', type: 'job', title: 'x' }).length).toBeGreaterThan(0);
  });

  it('accepts a well-formed attribution doc', () => {
    expect(validate(attribution)).toEqual([]);
  });

  it('rejects an attribution entry with a non-object author', () => {
    const bad = {
      ...attribution,
      items: { r_1: { addedIn: 'v1', addedBy: 'Geoff', lastChangedIn: 'v1', lastChangedBy: 'Geoff' } },
    };
    expect(validate(bad).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Run the test to verify it passes** (types/schemas are written in steps 1-2, so this should pass immediately)

Run: `npx vitest run src/shared/__tests__/sidecars.test.ts`
Expected: PASS, 7 tests passing. If any FAIL, fix `schema.ts`/`validate.ts` before continuing.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/schema.ts src/shared/validate.ts src/shared/__tests__/sidecars.test.ts
git commit -m "feat(shared): add releases/job/attribution sidecar contracts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: The semantic diff primitive

**Files:**
- Create: `src/shared/diff.ts`
- Modify: `src/shared/index.ts` (add the barrel export)
- Test: `src/shared/__tests__/diff.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/shared/__tests__/diff.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { diffItems, diffDocs } from '../diff';
import type { SrsDoc, SrsItem, VtpDoc } from '../schema';

function srs(items: SrsItem[]): SrsDoc {
  return { schemaVersion: '1.0', type: 'srs', name: 'AcmeApp', title: 'Reqs', items };
}

const base: SrsItem[] = [
  { id: 'r_001', code: 'FUNC-1', text: 'Authenticate users.', tags: ['auth'] },
  { id: 'r_002', code: 'FUNC-2', text: 'Log out users.' },
];

describe('diffItems', () => {
  it('reports an added item (present in new, absent in old)', () => {
    const next = [...base, { id: 'r_003', text: 'Reset password.' }];
    const d = diffItems(base, next);
    expect(d.added.map((c) => c.id)).toEqual(['r_003']);
    expect(d.added[0].after?.text).toBe('Reset password.');
    expect(d.removed).toEqual([]);
    expect(d.modified).toEqual([]);
  });

  it('reports a removed item (present in old, absent in new)', () => {
    const next = [base[0]];
    const d = diffItems(base, next);
    expect(d.removed.map((c) => c.id)).toEqual(['r_002']);
    expect(d.removed[0].before?.text).toBe('Log out users.');
    expect(d.added).toEqual([]);
  });

  it('reports a modified item with the exact changed fields', () => {
    const next: SrsItem[] = [{ ...base[0], text: 'Authenticate all users.' }, base[1]];
    const d = diffItems(base, next);
    expect(d.modified.map((c) => c.id)).toEqual(['r_001']);
    expect(d.modified[0].changedFields).toEqual(['text']);
    expect(d.modified[0].before?.text).toBe('Authenticate users.');
    expect(d.modified[0].after?.text).toBe('Authenticate all users.');
  });

  it('treats an added optional field as a change to that field', () => {
    const next: SrsItem[] = [{ ...base[1], hazards: ['SEC-1'] }, base[0]];
    const d = diffItems(base, next);
    const mod = d.modified.find((c) => c.id === 'r_002');
    expect(mod?.changedFields).toEqual(['hazards']);
  });

  it('keys on id: renaming code is a modification, never an add+remove', () => {
    const next: SrsItem[] = [{ ...base[0], code: 'AUTH-1' }, base[1]];
    const d = diffItems(base, next);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.modified.map((c) => c.id)).toEqual(['r_001']);
    expect(d.modified[0].changedFields).toEqual(['code']);
  });

  it('keys on id: reordering items is not a change', () => {
    const next = [base[1], base[0]];
    const d = diffItems(base, next);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.modified).toEqual([]);
  });

  it('compares array fields order-insensitively (whole-field)', () => {
    const old: SrsItem[] = [{ id: 'r_1', text: 'x', tags: ['a', 'b'] }];
    const next: SrsItem[] = [{ id: 'r_1', text: 'x', tags: ['b', 'a'] }];
    expect(diffItems(old, next).modified).toEqual([]);
  });

  it('flags an array field when its membership actually changes', () => {
    const old: SrsItem[] = [{ id: 'r_1', text: 'x', tags: ['a', 'b'] }];
    const next: SrsItem[] = [{ id: 'r_1', text: 'x', tags: ['a', 'c'] }];
    expect(diffItems(old, next).modified[0].changedFields).toEqual(['tags']);
  });

  it('treats an empty baseline as everything added', () => {
    const d = diffItems([], base);
    expect(d.added.map((c) => c.id)).toEqual(['r_001', 'r_002']);
    expect(d.removed).toEqual([]);
    expect(d.modified).toEqual([]);
  });

  it('diffs heading items by id like any other item', () => {
    const old: SrsItem[] = [{ id: 'h_1', heading: true, text: 'Functional' }];
    const next: SrsItem[] = [{ id: 'h_1', heading: true, text: 'Functional Requirements' }];
    expect(diffItems(old, next).modified[0].changedFields).toEqual(['text']);
  });
});

describe('diffDocs', () => {
  it('diffs two documents of the same type via their items', () => {
    const d = diffDocs(srs(base), srs([...base, { id: 'r_003', text: 'New.' }]));
    expect(d.added.map((c) => c.id)).toEqual(['r_003']);
  });

  it('throws when the two documents are of different types', () => {
    const vtp: VtpDoc = { schemaVersion: '1.0', type: 'vtp', name: 'A', title: 'T', items: [] };
    expect(() => diffDocs(srs(base), vtp)).toThrow(/different types/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/shared/__tests__/diff.test.ts`
Expected: FAIL — `Failed to resolve import "../diff"` (the module does not exist yet).

- [ ] **Step 3: Implement `diff.ts`**

Create `src/shared/diff.ts`:

```ts
// Pure, id-keyed semantic diff of SpecPad documents. No git, no I/O, no clock.
// See specpad-change-tracking-design.md §5. Assumes item ids are unique
// (uniqueness is the validate layer's concern, not this module's).
import type { SrsDoc, VtpDoc, SrsItem, VtpItem } from './schema';

export type ChangeStatus = 'added' | 'removed' | 'modified';

export interface ItemChange<T> {
  id: string;
  status: ChangeStatus;
  before?: T; // absent for 'added'
  after?: T; // absent for 'removed'
  changedFields?: string[]; // populated for 'modified'
}

export interface DocDiff<T> {
  added: ItemChange<T>[];
  removed: ItemChange<T>[];
  modified: ItemChange<T>[];
}

// Whole-field equality. Arrays (verifies/tags/hazards) compare order-insensitively;
// scalars compare with ===.
function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const sa = [...a].map((x) => JSON.stringify(x)).sort();
    const sb = [...b].map((x) => JSON.stringify(x)).sort();
    return sa.every((v, i) => v === sb[i]);
  }
  return a === b;
}

function changedFields<T extends { id: string }>(before: T, after: T): string[] {
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  keys.delete('id');
  const changed: string[] = [];
  for (const key of keys) {
    const bv = (before as Record<string, unknown>)[key];
    const av = (after as Record<string, unknown>)[key];
    if (!valuesEqual(bv, av)) changed.push(key);
  }
  return changed.sort();
}

export function diffItems<T extends { id: string }>(oldItems: T[], newItems: T[]): DocDiff<T> {
  const oldById = new Map(oldItems.map((i) => [i.id, i]));
  const newById = new Map(newItems.map((i) => [i.id, i]));
  const added: ItemChange<T>[] = [];
  const removed: ItemChange<T>[] = [];
  const modified: ItemChange<T>[] = [];

  for (const item of newItems) {
    if (!oldById.has(item.id)) added.push({ id: item.id, status: 'added', after: item });
  }
  for (const item of oldItems) {
    if (!newById.has(item.id)) removed.push({ id: item.id, status: 'removed', before: item });
  }
  for (const item of newItems) {
    const before = oldById.get(item.id);
    if (!before) continue;
    const fields = changedFields(before, item);
    if (fields.length > 0) {
      modified.push({ id: item.id, status: 'modified', before, after: item, changedFields: fields });
    }
  }
  return { added, removed, modified };
}

export function diffDocs(
  oldDoc: SrsDoc | VtpDoc,
  newDoc: SrsDoc | VtpDoc,
): DocDiff<SrsItem | VtpItem> {
  if (oldDoc.type !== newDoc.type) {
    throw new Error(
      `Cannot diff documents of different types: ${oldDoc.type} vs ${newDoc.type}`,
    );
  }
  return diffItems<SrsItem | VtpItem>(oldDoc.items, newDoc.items);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/shared/__tests__/diff.test.ts`
Expected: PASS, all 12 tests passing.

- [ ] **Step 5: Export from the barrel**

In `src/shared/index.ts`, add a line so it reads:

```ts
export * from './schema';
export * from './ids';
export * from './validate';
export * from './governance';
export * from './factories';
export * from './diff';
```

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm test`
Expected: PASS — all existing suites plus the two new files green.

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/shared/diff.ts src/shared/index.ts src/shared/__tests__/diff.test.ts
git commit -m "feat(shared): add id-keyed semantic diff primitive (diffItems/diffDocs)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (against design §3, §5, §12):**
- §3 sidecar shapes `releases` / `job` / `attribution` → Task 1 (types + schemas + validation). ✓
- §5 `diffItems` / `diffDocs`, `DocDiff`/`ItemChange`/`ChangeStatus`, id-keyed, pure, `changedFields` → Task 2. ✓
- §5 rename-`code`-is-not-churn and reorder-is-not-a-change → Task 2 Step 1 tests. ✓
- §9 empty/null baseline → Task 2 "empty baseline" test; §3 `baseline: null` → Task 1 test. ✓
- §12.1 whole-field array granularity (order-insensitive) → Task 2 array tests. ✓
- §12.2 author `{name, email}` → `AuthorRef` in Task 1. ✓
- §12.3 mirrored snapshot names → that is a Plan 2 (skill) concern; the `snapshot` path field is defined here, layout is enforced by the skill. ✓ (out of scope for Plan 1, noted)

**2. Placeholder scan:** No TBD/TODO; every code step contains complete code; every test step contains real assertions; every run step has an exact command and expected result. ✓

**3. Type consistency:** `diffItems`/`diffDocs`, `DocDiff`/`ItemChange`/`ChangeStatus`, `ReleasesDoc`/`JobDoc`/`AttributionDoc`/`AuthorRef`/`ReleaseEntry`/`AttributionEntry`/`SidecarDoc`/`SidecarType`, and schema names `releasesSchema`/`jobSchema`/`attributionSchema` are used identically in `schema.ts`, `validate.ts`, `diff.ts`, and both test files. ✓

---

## Out of scope (later plans)

- Git reading, `refresh`, redline, arbitrary-version diff, attribution generation, `Job:` trailer, commit helper, cache-regen golden test → **Plan 2 (skill git layer)**.
- Editor redline rendering, version-history timeline, inline attribution, current-job control, degraded state → **Plan 3 (editor UI)**.
- Skill↔shared parity test for diff/attribution behavior → **Plan 2** (extends `skill/__tests__/parity.test.ts`).
