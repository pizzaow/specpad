# Change Tracking — Plan 2: Skill Git-Plumbing Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adjust the shared contract for the revised (snapshot-only) architecture and teach the SpecPad skill to maintain the change-tracking cache as **pure git plumbing** — snapshots + manifest + `Job:` trailers — never computing diffs.

**Architecture:** Per the revised design (`docs/design/specpad-change-tracking-design.md`), the editor owns ALL diffing; the skill only moves bytes from git into a committed, regenerable cache. So this plan is deliberately small: (1) a TypeScript contract change — `ReleaseEntry` gains a per-release `author`, and the dead `attribution` sidecar (added in Plan 1, now superseded) is removed; (2) prose additions to `SKILL.md` documenting the cache layout and plumbing operations, with a starter manifest template and a doc-presence test. There is **no skill-side diff code** (and no CLI) — that is exactly why the two halves cannot drift.

**Tech Stack:** TypeScript, Ajv, Vitest. The skill itself is Markdown prose executed by Claude via Bash/git. Zero new dependencies.

**Source design:** `docs/design/specpad-change-tracking-design.md` — esp. §3 (artifacts, release `author`), §6 (skill plumbing), §12.2/§12.4/§12.5/§12.6 (resolved decisions).

---

## File Structure

- **Modify** `src/shared/schema.ts` — in the sidecar block: add `AuthorRef` to `ReleaseEntry` + `releasesSchema`; remove `AttributionEntry`/`AttributionDoc`/`attributionSchema`; narrow `SidecarType` to `'releases' | 'job'` and `SidecarDoc` to `ReleasesDoc | JobDoc`. (`AuthorRef` is kept — now reused for the release author.)
- **Modify** `src/shared/validate.ts` — drop `attributionSchema` from the import and the `validators` map.
- **Modify** `src/shared/__tests__/sidecars.test.ts` — remove the attribution tests; add release-`author` coverage and an "unknown type" guard proving `attribution` is gone.
- **Modify** `skill/specpad/SKILL.md` — add a "Change tracking (git plumbing)" section + extend "Scaffolding".
- **Create** `skill/specpad/templates/starter.releases.json` — empty starter manifest.
- **Create** `skill/__tests__/change-tracking.test.ts` — asserts SKILL.md documents the cache/operations and the starter manifest validates against the shared schema.

**Conventions to match:** schemas are `... as const` with `$id: 'specpad/v1/<type>'`; the existing parity test (`skill/__tests__/parity.test.ts`) uses `// @vitest-environment node` and `readFileSync(new URL(...))` — mirror that idiom for the new skill test.

---

## Task 1: Shared contract — add release author, remove the attribution sidecar

**Files:**
- Modify: `src/shared/schema.ts` (the sidecar block, currently ~lines 147–263)
- Modify: `src/shared/validate.ts` (import on line 3; `validators` map lines 12–19)
- Test: `src/shared/__tests__/sidecars.test.ts` (rewrite)

- [ ] **Step 1: Update the test first — replace the entire contents of `src/shared/__tests__/sidecars.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import type { ReleasesDoc, JobDoc } from '../schema';

const releases: ReleasesDoc = {
  schemaVersion: '1.0',
  type: 'releases',
  name: 'AcmeApp',
  tagPattern: 'v*',
  baseline: 'v26.1',
  releases: [
    {
      version: 'v24.0',
      ref: 'v24.0',
      date: '2025-11-02',
      author: { name: 'Geoff Pollard', email: 'geoff@example.com' },
      snapshot: null,
    },
    {
      version: 'v26.1',
      ref: 'v26.1',
      date: '2026-05-30',
      author: { name: 'Sam Lee', email: 'sam@example.com' },
      snapshot: '.specpad/baseline',
    },
  ],
};

const job: JobDoc = { schemaVersion: '1.0', type: 'job', job: 'PROJ-123', title: 'Add SSO' };

describe('sidecar schemas', () => {
  it('accepts a well-formed releases doc (with per-release author)', () => {
    expect(validate(releases)).toEqual([]);
  });

  it('accepts baseline: null with no releases yet', () => {
    expect(validate({ ...releases, baseline: null, releases: [] })).toEqual([]);
  });

  it('rejects a releases doc missing tagPattern', () => {
    const bad: Record<string, unknown> = { ...releases };
    delete bad.tagPattern;
    expect(validate(bad).length).toBeGreaterThan(0);
  });

  it('rejects a release entry missing author', () => {
    const bad = {
      ...releases,
      releases: [{ version: 'v1', ref: 'v1', date: '2025-01-01', snapshot: null }],
    };
    expect(validate(bad).length).toBeGreaterThan(0);
  });

  it('rejects a release entry whose author is not an object', () => {
    const bad = {
      ...releases,
      releases: [
        { version: 'v1', ref: 'v1', date: '2025-01-01', author: 'Geoff', snapshot: null },
      ],
    };
    expect(validate(bad).length).toBeGreaterThan(0);
  });

  it('accepts a well-formed job doc and one without a title', () => {
    expect(validate(job)).toEqual([]);
    expect(validate({ schemaVersion: '1.0', type: 'job', job: 'PROJ-9' })).toEqual([]);
  });

  it('rejects a job doc missing the job id', () => {
    expect(validate({ schemaVersion: '1.0', type: 'job', title: 'x' }).length).toBeGreaterThan(0);
  });

  it('no longer recognizes the removed attribution type', () => {
    const errs = validate({ schemaVersion: '1.0', type: 'attribution', items: {} });
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0].message).toContain('Unknown document type');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/shared/__tests__/sidecars.test.ts`
Expected: FAIL — the "missing author" / "author not an object" tests fail (author isn't required yet) and/or `ReleasesDoc` type errors, and the attribution test may still pass for the wrong reason. This confirms the schema needs updating.

- [ ] **Step 3: Replace the sidecar block in `src/shared/schema.ts`**

Replace everything from the comment line `// ---- Sidecar documents (change-tracking cache; ...` through the end of the `attributionSchema` declaration (the current end of file) with exactly:

```ts
// ---- Sidecar documents (change-tracking cache; see specpad-change-tracking-design.md) ----
// NOT part of the core proj/srs/vtp contract. Regenerable cache/config files.
// JSON Schema validates STRUCTURE ONLY, exactly like the core docs.
// The skill writes these; it never computes diffs. The editor diffs the snapshots.

export type SidecarType = 'releases' | 'job';

export interface AuthorRef {
  name: string;
  email: string;
}

export interface ReleaseEntry {
  version: string;
  ref: string;
  date: string;
  author: AuthorRef; // the release's tagger/committer (release-granularity attribution)
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

export type SidecarDoc = ReleasesDoc | JobDoc;

const nullableString = { type: ['string', 'null'] } as const;

const authorRefSchema = {
  type: 'object',
  required: ['name', 'email'],
  properties: { name: { type: 'string' }, email: { type: 'string' } },
} as const;

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
        required: ['version', 'ref', 'date', 'author', 'snapshot'],
        properties: {
          version: { type: 'string' },
          ref: { type: 'string' },
          date: { type: 'string' },
          author: authorRefSchema,
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
```

(Note: `authorRefSchema` is now declared **before** `releasesSchema` because the release-entry schema references it. `attributionSchema`, `AttributionEntry`, and `AttributionDoc` are deleted.)

- [ ] **Step 4: Update `src/shared/validate.ts`**

Change the import from `./schema` so it no longer pulls `attributionSchema`:

```ts
import {
  projectSchema,
  srsSchema,
  vtpSchema,
  releasesSchema,
  jobSchema,
} from './schema';
```

And remove the attribution line from the `validators` map so it reads:

```ts
const validators: Record<string, ValidateFunction> = {
  project: ajv.compile(projectSchema as object),
  srs: ajv.compile(srsSchema as object),
  vtp: ajv.compile(vtpSchema as object),
  releases: ajv.compile(releasesSchema as object),
  job: ajv.compile(jobSchema as object),
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/shared/__tests__/sidecars.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Confirm nothing else referenced the removed symbols**

Run: `grep -rn "attribution\|Attribution" src/ ; echo "exit: $?"`
Expected: no matches in `src/` (grep exit 1). If anything matches outside this task's files, stop and report.

- [ ] **Step 7: Full suite, typecheck, lint**

Run: `npm test` — expect all green.
Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run lint` — expect no errors/warnings.

- [ ] **Step 8: Commit**

```bash
git add src/shared/schema.ts src/shared/validate.ts src/shared/__tests__/sidecars.test.ts
git commit -m "feat(shared): add per-release author; remove the attribution sidecar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Teach the skill the git-plumbing operations (SKILL.md + template + test)

**Files:**
- Test: `skill/__tests__/change-tracking.test.ts` (create)
- Create: `skill/specpad/templates/starter.releases.json`
- Modify: `skill/specpad/SKILL.md` (add a section + extend "Scaffolding a new project")

- [ ] **Step 1: Write the failing test — create `skill/__tests__/change-tracking.test.ts`**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validate } from '../../src/shared/validate';

const skill = readFileSync(new URL('../specpad/SKILL.md', import.meta.url), 'utf8');
const template = readFileSync(
  new URL('../specpad/templates/starter.releases.json', import.meta.url),
  'utf8',
);

describe('skill documents the change-tracking plumbing', () => {
  it('documents the manifest, cache dir, and job marker files', () => {
    expect(skill).toContain('.releases.json');
    expect(skill).toContain('.specpad/');
    expect(skill).toContain('.job.json');
  });

  it('documents the core plumbing operations', () => {
    expect(skill).toMatch(/refresh/i);
    expect(skill).toMatch(/snapshot/i);
    expect(skill).toContain('Job:'); // the commit trailer
  });

  it('states the skill never computes diffs (the editor does)', () => {
    expect(skill.toLowerCase()).toContain('never');
    expect(skill).toMatch(/editor (computes|owns|diffs)/i);
  });
});

describe('starter releases template', () => {
  it('is valid JSON that passes the shared releases schema', () => {
    const doc = JSON.parse(template);
    expect(doc.type).toBe('releases');
    expect(doc.schemaVersion).toBe('1.0');
    expect(validate(doc)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run skill/__tests__/change-tracking.test.ts`
Expected: FAIL — `starter.releases.json` does not exist (read throws) and SKILL.md lacks the documented tokens.

- [ ] **Step 3: Create `skill/specpad/templates/starter.releases.json`**

```json
{
  "schemaVersion": "1.0",
  "type": "releases",
  "name": "PROJECT_NAME",
  "tagPattern": "v*",
  "baseline": null,
  "releases": []
}
```

- [ ] **Step 4: Add the change-tracking section to `skill/specpad/SKILL.md`**

Insert the following section immediately AFTER the "## Never store derived data or history" section and BEFORE "## Governance — enforce before finishing":

```markdown
## Change tracking (git plumbing only — never diff)

Change tracking is **derived from git and rendered by the editor**. Your only job is to keep a small,
committed, regenerable cache up to date. **You never compute diffs or attribution** — the editor
computes all redlines, version diffs, and attribution from the raw snapshots you write, using the
shared `diffDocs`. This is what guarantees the skill and editor can never disagree.

### Cache files (under `docs/specpad/`, all committed — never gitignore them)
- `<name>.releases.json` — the **manifest**: the release register the editor reads for its version
  timeline and baseline. Type `releases`. User-editable.
- `<name>.job.json` — optional **current-job marker** (`{ "type": "job", "job": "PROJ-123",
  "title": "..." }`). Set by the user (often in the editor); you fold it into commit trailers.
- `.specpad/baseline/` — raw snapshot of the spec files at the latest release (always present once
  refreshed).
- `.specpad/snapshots/<version>/` — raw snapshots of older releases, pulled on demand and then kept.

`.specpad/` is a normal committed directory (deliberately not named `.cache/`, which many global
gitignores exclude). It holds **only verbatim copies** of past spec files — never diffs.

### `refresh` — keep the manifest and baseline current (idempotent)
Run at release time or on request:
1. Determine the tag pattern: use `tagPattern` from `<name>.releases.json` if present, else default
   `v*`. List matching tags newest-last: `git tag --list '<pattern>' --sort=creatordate`.
2. For every matching tag not already in `releases.json`, append an entry
   `{ version, ref, date, author, snapshot }`:
   - `date`: `git log -1 --format=%cs <tag>` (commit date, `YYYY-MM-DD`).
   - `author`: the release's tagger/committer — `git log -1 --format='%an<TAB>%ae' <tag>` →
     `{ "name": ..., "email": ... }`. (This is **release-granularity** "who", not per-item.)
   - `snapshot`: `null` for now (filled in only when cached).
3. Regenerate `.specpad/baseline/` from the newest matching tag: for each spec file
   `git show <tag>:docs/specpad/<file>` and write it under `.specpad/baseline/` mirroring the
   top-level file names. Set that release's `snapshot` to `".specpad/baseline"` and set the top-level
   `baseline` to that version.
4. Re-validate every JSON file you wrote.

If there are **no matching tags**, write a manifest with `baseline: null` and `releases: []` (copy
`templates/starter.releases.json`); the editor degrades gracefully.

### `pull <version>` — cache an older snapshot on demand
`git show <ref>:docs/specpad/<file>` for each spec file into `.specpad/snapshots/<version>/`
(mirroring top-level names), then set that release entry's `snapshot` to that path. Do **not** diff.

### Commit workflow (jobs)
Each commit should carry its spec/test edits and a job. When you commit on the user's behalf:
- If `<name>.job.json` exists, add a `Job: <job>` trailer to the commit message.
- Pre-commit check (name-level, **not** a semantic diff): if code files are staged, confirm the
  related `docs/specpad/*.json` are staged too when requirements/tests changed — use
  `git diff --cached --name-only`. Warn if spec/test updates look missing.

### On-demand reports (advisory prose, never cached)
When asked "what changed for the next release", "trace job PROJ-123", or "who last changed r_x":
walk git directly (`git log`, `git describe --tags`, `--grep='Job: PROJ-123'`) and summarize in prose.
These are advisory; they are not written to the cache and nothing depends on them.
```

- [ ] **Step 5: Extend the "Scaffolding a new project" section in `SKILL.md`**

In the "## Scaffolding a new project" numbered list, change step 2 and add a step so it reads:

```markdown
1. Create `docs/specpad/` if missing.
2. Copy the templates from this skill's `templates/` folder, replacing every `PROJECT_NAME` token
   with the system's short name: `starter.proj.json`, `starter.srs.json`, `starter.vtp.json`, and
   `starter.releases.json` (the empty change-tracking manifest). `.specpad/` is created later, on the
   first `refresh`.
3. Validate (see "Validate before finishing").
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run skill/__tests__/change-tracking.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Full suite (incl. existing parity test), lint**

Run: `npm test` — expect all green (the existing `skill/__tests__/parity.test.ts` still passes).
Run: `npm run lint` — expect no errors.

- [ ] **Step 8: Commit**

```bash
git add skill/specpad/SKILL.md skill/specpad/templates/starter.releases.json skill/__tests__/change-tracking.test.ts
git commit -m "skill(specpad): document change-tracking git plumbing + starter manifest

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (against revised design):**
- §3 release `author` field → Task 1 (schema + type + tests). ✓
- §3 attribution.json removed → Task 1 deletes the sidecar; "unknown type" test guards it. ✓
- §3 cache file shapes (`releases.json`, `job.json`, `.specpad/baseline|snapshots`) → SKILL.md section + test. ✓
- §6 `refresh` (manifest incl. author, baseline snapshot), `pull`, pre-commit check, `Job:` trailer, on-demand reports, "skill never diffs / no CLI" → SKILL.md section + doc-presence test. ✓
- §3 starter manifest for scaffolding/graceful degradation → `starter.releases.json` + scaffolding step + schema-validation test. ✓
- §12.2 per-release author; §12.4 diff only in editor; §12.5 no CLI; §12.6 attribution removed → all reflected. ✓

**2. Placeholder scan:** No TBD/TODO. Every code/test step has complete content; every run step has an exact command + expected result. `PROJECT_NAME` in the template is an intentional scaffolding token (the existing templates use it), not a placeholder defect.

**3. Type/name consistency:** `ReleaseEntry.author: AuthorRef`, `AuthorRef {name,email}`, `releasesSchema` required `['version','ref','date','author','snapshot']`, `SidecarType = 'releases' | 'job'`, `SidecarDoc = ReleasesDoc | JobDoc`, and `validators` keys `releases`/`job` are consistent across `schema.ts`, `validate.ts`, and both test files. The doc test's asserted tokens (`.releases.json`, `.specpad/`, `.job.json`, `refresh`, `snapshot`, `Job:`, `never`, `editor … computes/owns/diffs`) are all present verbatim in the SKILL.md prose added in Steps 4–5.

---

## Out of scope (Plan 3 — editor UI)

Redline rendering in `SRSTable`/`VTPTable`, the version-history timeline, snapshot-derived attribution display (pairing version with the manifest `author`), arbitrary-version diff in-UI, current-job control, and the degraded-when-no-cache state — all editor work, planned and executed separately as Plan 3, consuming the contract finalized here.
