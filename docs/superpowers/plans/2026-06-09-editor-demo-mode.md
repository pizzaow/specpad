# Editor Demo Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only demo mode for the hosted editor (`specpad.com/v01/?demo`) that loads SpecPad's own dogfood spec over HTTP — tables, testing view, validation, version history, redlines, and job chip all working — with saving disabled and a visible "Demo — read-only" indicator.

**Architecture:** `src/localFileApi.ts` (the schema-agnostic transport) gains a module-level demo mode: when enabled, every read fetches from a hosted base URL (`/demo/`) instead of the File System Access API, and every write throws. A `manifest.json` (generated at deploy/dev-serve time) substitutes for directory listing. `LocalApp` enables demo mode when the URL carries `?demo`, and passes a `demo` flag down so `MenuBar` hides write affordances and `StatusBar` shows the read-only badge. `deploy.sh --ship` uploads `docs/specpad/` to `s3://…/demo/`; a tiny Vite middleware serves the same files at `/demo/` in dev.

**Tech Stack:** React 18 + TypeScript, Vite 5, Vitest 2 (jsdom + Testing Library), bash + AWS CLI for deploy. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-09-landing-page-design.md` §6 + §8 items 3/5-partial. (The marketing site, reference page, skill zip, and CloudFront apex change are **Plan 2**, written after this plan ships.)

**Branch:** create `feat/editor-demo-mode` (via superpowers:using-git-worktrees) before Task 1. One PR for the whole plan.

**Context for the implementer:**
- `npm test` runs Vitest; `npx tsc --noEmit` type-checks; `npm run lint` lints. Run all three before claiming done.
- `src/localFileApi.ts` holds module-level state (`projectDirHandle`, `projectName`). Demo mode adds parallel module-level state — this matches the file's existing style.
- The dogfood project at `docs/specpad/` already has committed snapshots (`.specpad/baseline/`, `.specpad/snapshots/v0.1/`) and a releases manifest with `baseline: "v1.0"` — version history and redlines will light up in the demo with no extra content work.
- `docs/specpad/index.html` is a local launcher that redirects to the hosted editor — it is *not* demo content and must not be uploaded to `/demo/`.

---

### Task 1: Demo transport in `localFileApi.ts`

**Files:**
- Modify: `src/localFileApi.ts`
- Test: `src/__tests__/localFileApi.demo.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/localFileApi.demo.test.ts`:

```typescript
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  classifyDocFilename,
  enableDemoMode,
  disableDemoMode,
  isDemoMode,
  openDemoProject,
  listDocuments,
  loadDocument,
  loadReleases,
  loadJob,
  loadSnapshot,
  saveDocument,
  saveJob,
  hasOpenDirectory,
} from '../localFileApi';
import type { SrsDoc, ReleasesDoc, JobDoc } from '../shared';

const srsDoc: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'specpad', title: 'SRS',
  items: [{ id: 'r_001', text: 'A requirement' }],
};
const releasesDoc: ReleasesDoc = {
  schemaVersion: '1.0', type: 'releases', name: 'specpad', tagPattern: 'v*',
  baseline: 'v1.0',
  releases: [{
    version: 'v1.0', ref: 'abc', date: '2026-06-07',
    author: { name: 'G', email: 'g@x.com' }, snapshot: '.specpad/baseline',
  }],
};
const jobDoc: JobDoc = { schemaVersion: '1.0', type: 'job', job: 'landing-page' };

/** Stub global fetch: exact-URL routes; anything else is a 404. */
function stubFetch(routes: Record<string, unknown>) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url);
    if (url in routes) {
      return {
        ok: true, status: 200,
        text: async () => JSON.stringify(routes[url]),
        json: async () => routes[url],
      } as unknown as Response;
    }
    return {
      ok: false, status: 404,
      text: async () => 'Not found', json: async () => ({}),
    } as unknown as Response;
  }));
  return calls;
}

const MANIFEST = { documents: ['specpad.proj.json', 'specpad.srs.json', 'specpad.vtp.json'] };

afterEach(() => {
  disableDemoMode();
  vi.unstubAllGlobals();
});

describe('classifyDocFilename', () => {
  it('classifies srs/vtp/proj filenames and rejects everything else', () => {
    expect(classifyDocFilename('app.srs.json')).toEqual({ type: 'srs', name: 'app', filename: 'app.srs.json' });
    expect(classifyDocFilename('app.vtp.json')).toEqual({ type: 'vtp', name: 'app', filename: 'app.vtp.json' });
    expect(classifyDocFilename('app.proj.json')).toEqual({ type: 'proj', name: 'app', filename: 'app.proj.json' });
    expect(classifyDocFilename('app.releases.json')).toBeNull();
    expect(classifyDocFilename('app.job.json')).toBeNull();
    expect(classifyDocFilename('manifest.json')).toBeNull();
    expect(classifyDocFilename('index.html')).toBeNull();
  });
});

describe('demo mode', () => {
  it('openDemoProject loads the manifest and classifies documents', async () => {
    stubFetch({ '/demo/manifest.json': MANIFEST });
    enableDemoMode('/demo/');
    const result = await openDemoProject();
    expect(result.name).toBe('specpad');
    expect(result.documents).toHaveLength(3);
    expect(isDemoMode()).toBe(true);
    expect(hasOpenDirectory()).toBe(true);
    expect(await listDocuments()).toEqual(result.documents);
  });

  it('openDemoProject throws a friendly error when the manifest is missing', async () => {
    stubFetch({});
    enableDemoMode('/demo/');
    await expect(openDemoProject()).rejects.toThrow(/demo manifest/i);
  });

  it('loadDocument fetches from the demo base URL', async () => {
    const calls = stubFetch({
      '/demo/manifest.json': MANIFEST,
      '/demo/specpad.srs.json': srsDoc,
    });
    enableDemoMode('/demo/');
    await openDemoProject();
    const doc = await loadDocument('srs', 'specpad');
    expect(doc).toEqual(srsDoc);
    expect(calls).toContain('/demo/specpad.srs.json');
  });

  it('loadReleases and loadJob fetch sidecars, returning null on 404', async () => {
    stubFetch({ '/demo/specpad.releases.json': releasesDoc });
    enableDemoMode('/demo/');
    expect(await loadReleases('specpad')).toEqual(releasesDoc);
    expect(await loadJob('specpad')).toBeNull();
  });

  it('loadSnapshot maps baseline and version locations to URLs, null on 404', async () => {
    const calls = stubFetch({ '/demo/.specpad/baseline/specpad.srs.json': srsDoc });
    enableDemoMode('/demo/');
    expect(await loadSnapshot('baseline', 'srs', 'specpad')).toEqual(srsDoc);
    expect(await loadSnapshot({ version: 'v0.1' }, 'srs', 'specpad')).toBeNull();
    expect(calls).toContain('/demo/.specpad/baseline/specpad.srs.json');
    expect(calls).toContain('/demo/.specpad/snapshots/v0.1/specpad.srs.json');
  });

  it('writes throw a read-only error', async () => {
    stubFetch({ '/demo/manifest.json': MANIFEST });
    enableDemoMode('/demo/');
    await openDemoProject();
    await expect(saveDocument(srsDoc)).rejects.toThrow(/read-only demo/i);
    await expect(saveJob('specpad', jobDoc)).rejects.toThrow(/read-only demo/i);
  });

  it('enableDemoMode normalizes a base URL without a trailing slash', async () => {
    const calls = stubFetch({ '/demo/manifest.json': MANIFEST });
    enableDemoMode('/demo');
    await openDemoProject();
    expect(calls).toContain('/demo/manifest.json');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/localFileApi.demo.test.ts`
Expected: FAIL — `classifyDocFilename`, `enableDemoMode`, etc. are not exported.

- [ ] **Step 3: Implement the demo transport**

In `src/localFileApi.ts`:

**3a.** After the `let projectName = '';` line (line ~26), add:

```typescript
// ---- Demo mode (read-only, HTTP-backed) ----
// When enabled, every read fetches from `demoBaseUrl` instead of the File
// System Access API, and every write throws. A manifest.json substitutes for
// directory listing (you cannot list an HTTP "directory").

let demoBaseUrl: string | null = null;
let demoDocuments: DocumentListItem[] = [];

const READ_ONLY_DEMO = 'This is a read-only demo — changes cannot be saved';

/** Enable read-only demo mode, reading from `baseUrl` (e.g. "/demo/"). */
export function enableDemoMode(baseUrl: string): void {
  demoBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  demoDocuments = [];
}

/** Reset demo mode (used by tests; a real session never leaves demo mode). */
export function disableDemoMode(): void {
  demoBaseUrl = null;
  demoDocuments = [];
}

export function isDemoMode(): boolean {
  return demoBaseUrl !== null;
}

async function fetchDemoJson(relPath: string): Promise<SpecPadDoc | null> {
  const res = await fetch(demoBaseUrl + relPath, { cache: 'no-cache' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Demo fetch failed (HTTP ${res.status}): ${relPath}`);
  return parseDocument(await res.text());
}

/** Open the hosted demo project: fetch the manifest and classify its documents. */
export async function openDemoProject(): Promise<{ name: string; documents: DocumentListItem[] }> {
  if (!demoBaseUrl) throw new Error('Demo mode is not enabled');
  const res = await fetch(`${demoBaseUrl}manifest.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load the demo manifest (HTTP ${res.status})`);
  const manifest = (await res.json()) as { documents: string[] };
  demoDocuments = manifest.documents
    .map(classifyDocFilename)
    .filter((d): d is DocumentListItem => d !== null);
  const projFile = demoDocuments.find((d) => d.type === 'proj');
  projectName = projFile ? projFile.name : (demoDocuments[0]?.name ?? '');
  return { name: projectName, documents: demoDocuments };
}
```

**3b.** Add the pure classifier and rewrite `listDocumentsInDirectory` to use it (replacing the three regex matches):

```typescript
/** Classify a `[name].[type].json` filename; null for non-document files. */
export function classifyDocFilename(filename: string): DocumentListItem | null {
  const m = filename.match(/^(.+?)\.(srs|vtp|proj)\.json$/);
  if (!m) return null;
  return { type: m[2] as DocKind, name: m[1], filename };
}

async function listDocumentsInDirectory(): Promise<DocumentListItem[]> {
  if (!projectDirHandle) throw new Error('No directory selected');
  const documents: DocumentListItem[] = [];
  for await (const entry of (projectDirHandle as any).values()) {
    if (entry.kind !== 'file') continue;
    const item = classifyDocFilename(entry.name);
    if (item) documents.push(item);
  }
  return documents;
}
```

**3c.** Add demo branches at the TOP of each of these existing functions:

```typescript
// in listDocuments():
  if (demoBaseUrl) return demoDocuments;

// in readJson(filename):
  if (demoBaseUrl) {
    const doc = await fetchDemoJson(filename);
    if (!doc) throw new Error(`Document not found: ${filename}`);
    return doc;
  }

// in saveDocument(doc):
  if (demoBaseUrl) throw new Error(READ_ONLY_DEMO);

// in saveJob(name, doc):
  if (demoBaseUrl) throw new Error(READ_ONLY_DEMO);

// in loadReleases(name):
  if (demoBaseUrl) return (await fetchDemoJson(`${name}.releases.json`)) as ReleasesDoc | null;

// in loadJob(name):
  if (demoBaseUrl) return (await fetchDemoJson(`${name}.job.json`)) as JobDoc | null;

// in loadSnapshot(location, type, name):
  if (demoBaseUrl) {
    return fetchDemoJson(`${snapshotDirSegments(location).join('/')}/${name}.${type}.json`);
  }
```

**3d.** Change `hasOpenDirectory` so the shell treats the demo as an open project:

```typescript
export function hasOpenDirectory(): boolean {
  return demoBaseUrl !== null || projectDirHandle !== null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/localFileApi.demo.test.ts src/__tests__/localFileApi.test.ts`
Expected: PASS (both new demo tests and the existing transport tests — the `classifyDocFilename` refactor must not break directory listing).

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/localFileApi.ts src/__tests__/localFileApi.demo.test.ts
git commit -m "feat(editor): read-only HTTP demo transport in localFileApi"
```

---

### Task 2: `demo` launch parameter

**Files:**
- Modify: `src/launchParams.ts`
- Test: `src/__tests__/launchParams.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Add to `src/__tests__/launchParams.test.ts` (match the existing test style for constructing `Location`-like objects — read the file first; existing assertions that compare full result objects will need `demo: false` added):

```typescript
it('parses ?demo from the query string', () => {
  const p = parseLaunchParams({ hash: '', search: '?demo' } as Location);
  expect(p.demo).toBe(true);
});

it('demo defaults to false', () => {
  const p = parseLaunchParams({ hash: '#name=specpad&open=srs', search: '' } as Location);
  expect(p.demo).toBe(false);
});

it('parses ?demo even when launcher params ride in the fragment', () => {
  const p = parseLaunchParams({ hash: '#name=specpad', search: '?demo' } as Location);
  expect(p.demo).toBe(true);
  expect(p.name).toBe('specpad');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/launchParams.test.ts`
Expected: FAIL — `demo` is undefined.

- [ ] **Step 3: Implement**

In `src/launchParams.ts`, add `demo: boolean;` to `LaunchParams` and parse it from BOTH the search string and the merged params (the launcher puts its params in the fragment; `?demo` arrives in the query string and must not be masked by a fragment):

```typescript
export interface LaunchParams {
  name?: string;
  open?: OpenView;
  dir?: string; // the launcher's own folder path, used only to correlate locally
  demo: boolean; // read-only hosted demo (specpad.com/v01/?demo)
}

export function parseLaunchParams(loc: Location = window.location): LaunchParams {
  const fromHash = loc.hash && loc.hash.length > 1 ? loc.hash.slice(1) : '';
  const raw = fromHash || loc.search.replace(/^\?/, '');
  const p = new URLSearchParams(raw);
  const search = new URLSearchParams(loc.search.replace(/^\?/, ''));
  const open = p.get('open');
  return {
    name: p.get('name') || undefined,
    open: open === 'srs' || open === 'vtp' || open === 'testing' ? open : undefined,
    dir: p.get('dir') || undefined,
    demo: search.has('demo') || p.has('demo'),
  };
}
```

- [ ] **Step 4: Run tests, fix existing expectations**

Run: `npx vitest run src/__tests__/launchParams.test.ts`
Expected: new tests PASS; if existing tests compare whole objects with `toEqual`, add `demo: false` to their expected values until the file passes.

- [ ] **Step 5: Commit**

```bash
git add src/launchParams.ts src/__tests__/launchParams.test.ts
git commit -m "feat(editor): parse ?demo launch parameter"
```

---

### Task 3: Demo wiring in `LocalApp`, `MenuBar`, `StatusBar`

**Files:**
- Modify: `src/LocalApp.tsx`, `src/components/MenuBar.tsx`, `src/components/StatusBar.tsx`, `src/specpad.less`
- Test: `src/__tests__/LocalApp.demo.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/LocalApp.demo.test.tsx` (mock pattern mirrors `LocalApp.test.tsx`):

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SrsDoc, VtpDoc, ProjectDoc } from '../shared';

const demoSrs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'specpad', title: 'SpecPad SRS',
  items: [{ id: 'r_001', text: 'Demo requirement text' }],
};
const demoVtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'specpad', title: 'SpecPad VTP',
  items: [{ id: 't_001', text: 'Demo test', verifies: ['r_001'], expected: 'Works' }],
};
const demoProj: ProjectDoc = {
  schemaVersion: '1.0', type: 'project', name: 'specpad', title: 'SpecPad',
  documents: [],
};

vi.mock('../launchParams', () => ({
  parseLaunchParams: () => ({ demo: true }),
}));

vi.mock('../localFileApi', () => ({
  isFileSystemAccessSupported: () => true,
  isDemoMode: () => true,
  enableDemoMode: vi.fn(),
  openDemoProject: vi.fn(async () => ({
    name: 'specpad',
    documents: [
      { type: 'proj', name: 'specpad', filename: 'specpad.proj.json' },
      { type: 'srs', name: 'specpad', filename: 'specpad.srs.json' },
      { type: 'vtp', name: 'specpad', filename: 'specpad.vtp.json' },
    ],
  })),
  hasOpenDirectory: () => true,
  getCurrentProjectName: () => 'specpad',
  openProjectDirectory: vi.fn(),
  openProjectFile: vi.fn(),
  listDocuments: vi.fn(async () => []),
  loadProject: vi.fn(async () => demoProj),
  loadDocument: vi.fn(async (type: 'srs' | 'vtp') => (type === 'srs' ? demoSrs : demoVtp)),
  saveDocument: vi.fn(),
  createNewDocument: vi.fn(),
  openFileFallback: vi.fn(),
  saveFileFallback: vi.fn(),
  serializeDocument: vi.fn(),
  loadReleases: vi.fn(async () => null),
  loadJob: vi.fn(async () => null),
  saveJob: vi.fn(async () => undefined),
  loadSnapshot: vi.fn(async () => null),
  getDirHandle: vi.fn(() => null),
  verifyPermission: vi.fn(async () => false),
  openProjectFromHandle: vi.fn(),
}));

import LocalApp from '../LocalApp';
import { enableDemoMode, openDemoProject } from '../localFileApi';

describe('LocalApp demo mode', () => {
  it('auto-loads the demo project read-only', async () => {
    render(<LocalApp />);

    // Demo project loads without any picker interaction.
    expect(await screen.findByText('Demo requirement text')).toBeInTheDocument();
    expect(enableDemoMode).toHaveBeenCalledWith('/demo/');
    expect(openDemoProject).toHaveBeenCalled();

    // Read-only indicator is visible.
    expect(screen.getByText(/Demo — read-only/)).toBeInTheDocument();

    // No Save button, and no "New document…" in the File menu.
    expect(screen.queryByLabelText('Save')).toBeNull();
    fireEvent.click(screen.getByText('File ▾'));
    expect(screen.queryByText('New document…')).toBeNull();
  });

  it('shows a friendly error when the demo fails to load', async () => {
    (openDemoProject as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('HTTP 503'));
    render(<LocalApp />);
    expect(await screen.findByText(/Could not load the demo project/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/LocalApp.demo.test.tsx`
Expected: FAIL — demo never loads (no demo effect in LocalApp yet).

- [ ] **Step 3: Implement `LocalApp` demo wiring**

In `src/LocalApp.tsx`:

**3a.** Extend the `localFileApi` import list with `enableDemoMode` and `openDemoProject`.

**3b.** In the on-load `useEffect` (currently starting `if (launch.open) setCurrentView(launch.open);`), insert the demo branch right after the `launch.open` line — demo skips the recent-projects logic entirely:

```typescript
    if (launch.demo) {
      void (async () => {
        setLoading(true);
        try {
          enableDemoMode('/demo/');
          const result = await openDemoProject();
          await applyOpened(result, launch.name);
        } catch {
          setError('Could not load the demo project — please try again later.');
        } finally {
          setLoading(false);
        }
      })();
      return;
    }
```

(`applyOpened` already no-ops the recent-projects store when `getDirHandle()` is null, and auto-loads the single document name — no changes needed there.)

**3c.** Gate the Ctrl+S handler and the unsaved-changes unload guard — in the existing keyboard/unload `useEffect`, change both checks to skip demo:

```typescript
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!launch.demo && shortcutRef.current.dirty) void shortcutRef.current.save();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!launch.demo && shortcutRef.current.dirty) { e.preventDefault(); e.returnValue = ''; }
    };
```

**3d.** Pass the flag down — in the JSX, add `demo={launch.demo}` to `<MenuBar …>` and `<StatusBar …>`. Also change the StatusBar `path` prop to show the demo origin honestly:

```tsx
      {isDirectoryOpen && (
        <StatusBar
          path={launch.demo ? 'demo (hosted copy of docs/specpad/)' : `docs/specpad/${projectName}`}
          srsDoc={srsDoc} vtpDoc={vtpDoc} projectDoc={projectDoc}
          demo={launch.demo}
        />
      )}
```

**3e.** In `src/components/MenuBar.tsx`, add `demo?: boolean;` to `MenuBarProps`, then:
- Save button: render only when `p.isDirectoryOpen && !p.demo`.
- "New document…" item: render only when `p.isDirectoryOpen && !p.demo`.
- Job chip: in demo, show it as a static label (no dropdown/JobControl):

```tsx
      {p.isDirectoryOpen && p.demo && p.job && (
        <span className="menubar-project">Job: {p.job.job}</span>
      )}
      {p.isDirectoryOpen && !p.demo && (
        <span className="menubar-dropdown">
          {/* existing job dropdown markup unchanged */}
        </span>
      )}
```

**3f.** In `src/components/StatusBar.tsx`, add `demo?: boolean` to the props interface and destructure it; render the badge right after the path span:

```tsx
      {demo && <span className="status-demo">Demo — read-only</span>}
```

**3g.** In `src/specpad.less`, next to the existing `.status-bar` rules, add (match the file's existing formatting conventions):

```less
.status-demo {
  background: #f0ad4e;
  color: #fff;
  border-radius: 3px;
  padding: 1px 8px;
  margin-left: 10px;
  font-weight: 600;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/LocalApp.demo.test.tsx src/__tests__/LocalApp.test.tsx src/__tests__/LocalApp.recent.test.tsx src/components/__tests__`
Expected: PASS — including the existing LocalApp and component tests (the non-demo path must be unchanged; existing tests' launchParams are unmocked so `demo` comes back false from the real parser… note `LocalApp.test.tsx` does NOT mock launchParams, and jsdom's default URL has no `?demo`, so it parses `demo: false` naturally).

- [ ] **Step 5: Type-check, lint, commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
git add src/LocalApp.tsx src/components/MenuBar.tsx src/components/StatusBar.tsx src/specpad.less src/__tests__/LocalApp.demo.test.tsx
git commit -m "feat(editor): read-only demo mode UI (?demo loads hosted dogfood spec)"
```

---

### Task 4: Serve `/demo/` in the Vite dev server

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Add the middleware plugin**

In `vite.config.ts`, add the imports and plugin, and register it in `plugins`:

```typescript
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Plugin, Connect } from 'vite';

// Serve docs/specpad/ at /demo/ in dev and preview, with a generated
// manifest.json, so `npm run dev` + /?demo exercises the real demo flow.
// Production serves the same files from S3 (uploaded by infra/deploy.sh).
function demoContent(): Plugin {
  const root = path.resolve(__dirname, 'docs/specpad');
  const handler: Connect.NextHandleFunction = async (req, res, next) => {
    const url = (req.url || '/').split('?')[0];
    try {
      if (url === '/manifest.json') {
        const entries = await fs.readdir(root);
        const documents = entries.filter((f) => /\.(srs|vtp|proj)\.json$/.test(f));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ documents }));
        return;
      }
      const file = path.normalize(path.join(root, url));
      if (!file.startsWith(root) || !file.endsWith('.json')) { next(); return; }
      const data = await fs.readFile(file);
      res.setHeader('Content-Type', 'application/json');
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  };
  return {
    name: 'specpad-demo-content',
    configureServer(server) { server.middlewares.use('/demo', handler); },
    configurePreview(server) { server.middlewares.use('/demo', handler); },
  };
}
```

…and change `plugins: [react()]` to `plugins: [react(), demoContent()]`.

- [ ] **Step 2: Verify manually**

Run: `npm run dev` (background), then:
- `curl http://localhost:5173/demo/manifest.json` → `{"documents":["specpad.proj.json","specpad.srs.json","specpad.vtp.json"]}`
- `curl http://localhost:5173/demo/.specpad/baseline/specpad.srs.json` → JSON document
- Open `http://localhost:5173/?demo` in a browser: the SpecPad project loads with no picker; SRS/VTP/Testing tabs work; the version chip (`v1.0 ▾`) opens history; the "Demo — read-only" badge shows; there is no Save button. Stop the dev server after.

- [ ] **Step 3: Run the full suite, commit**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

```bash
git add vite.config.ts
git commit -m "feat(dev): serve docs/specpad at /demo with generated manifest"
```

---

### Task 5: Dogfood content — job marker + sidecar validation

**Files:**
- Create: `docs/specpad/specpad.job.json`
- Modify: `src/shared/__tests__/dogfood.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/shared/__tests__/dogfood.test.ts`, add imports and extend the structural test:

```typescript
import releases from '../../../docs/specpad/specpad.releases.json';
import job from '../../../docs/specpad/specpad.job.json';
```

…and inside the `passes structural validation for every document` test, add:

```typescript
    expect(validate(releases)).toEqual([]);
    expect(validate(job)).toEqual([]);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/__tests__/dogfood.test.ts`
Expected: FAIL — `specpad.job.json` does not exist (import error).

- [ ] **Step 3: Create the job marker**

Create `docs/specpad/specpad.job.json`:

```json
{
  "schemaVersion": "1.0",
  "type": "job",
  "job": "landing-page",
  "title": "Landing page & live demo"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/__tests__/dogfood.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/specpad/specpad.job.json src/shared/__tests__/dogfood.test.ts
git commit -m "dogfood: set active job marker; validate sidecars in dogfood test"
```

---

### Task 6: Dogfood spec update — demo-mode requirements & tests

Per the project rule (see memory: keep dogfood spec in sync), the demo-mode feature must be recorded in SpecPad's own SRS/VTP.

**Files:**
- Modify: `docs/specpad/specpad.srs.json`, `docs/specpad/specpad.vtp.json`

- [ ] **Step 1: Add requirements and tests following `skill/specpad/SKILL.md` conventions**

Read `skill/specpad/SKILL.md` first and follow its id/code/editing rules exactly (generate fresh unique ids per `src/shared/ids.ts` conventions; reuse the existing section structure of the documents — read both files to find the right section, likely the editor section). Add:

To `specpad.srs.json` (two requirements):
1. Text: "When launched with the `demo` query parameter, the editor loads the project read-only over HTTP from the hosted demo directory (`/demo/`), with document tables, testing view, validation, version history, redlines, and the job indicator available."
2. Text: "In demo mode the editor disables all writes (save, new document, set job) and displays a visible read-only indicator."

To `specpad.vtp.json` (two tests, each with `verifies` pointing at the corresponding new requirement's **id**):
1. Text: "Open the editor with `?demo` and confirm the SpecPad demo project loads without any folder picker, with SRS, VTP, and Testing views populated and version history openable." Expected: "Demo project loads read-only over HTTP; all read views function."
2. Text: "In demo mode, confirm no Save button or New-document action is offered, Ctrl+S does nothing, and a 'Demo — read-only' indicator is shown." Expected: "All write affordances absent or inert; read-only indicator visible."

- [ ] **Step 2: Verify the documents stay valid and governance-clean**

Run: `npm test`
Expected: PASS — `dogfood.test.ts` (structure + governance) and `skill/__tests__/parity.test.ts` stay green.

- [ ] **Step 3: Commit**

```bash
git add docs/specpad/specpad.srs.json docs/specpad/specpad.vtp.json
git commit -m "dogfood(specpad): add demo-mode requirements and verification tests"
```

---

### Task 7: Ship demo content from `deploy.sh`

**Files:**
- Modify: `infra/deploy.sh` (the `--ship` block), `infra/README.md`

- [ ] **Step 1: Extend the ship path**

In `infra/deploy.sh`, replace the body of the `--ship` block (currently "Ship 1/3 … Ship 3/3") with:

```bash
  log "Ship 1/4: build"
  ( cd "$ROOT_DIR" && npm run build )
  log "Ship 2/4: upload editor to s3://$BUCKET/$PREFIX/"
  aws s3 sync "$ROOT_DIR/dist/" "s3://$BUCKET/$PREFIX/" --delete
  log "Ship 3/4: upload demo content to s3://$BUCKET/demo/"
  # Stage so the generated manifest and the sync --delete see one consistent tree.
  DEMO_STAGE="$(mktemp -d)"
  cp -r "$ROOT_DIR/docs/specpad/." "$DEMO_STAGE/"
  rm -f "$DEMO_STAGE/index.html"   # local launcher, not demo content
  ( cd "$DEMO_STAGE" && node -e '
    const fs = require("fs");
    const documents = fs.readdirSync(".").filter((f) => /\.(srs|vtp|proj)\.json$/.test(f));
    fs.writeFileSync("manifest.json", JSON.stringify({ documents }, null, 2));
  ' )
  aws s3 sync "$DEMO_STAGE/" "s3://$BUCKET/demo/" --delete
  rm -rf "$DEMO_STAGE"
  log "Ship 4/4: invalidate CloudFront ($DIST_ID)"
  INVALIDATION_ID=$(aws cloudfront create-invalidation --distribution-id "$DIST_ID" \
    --paths "/$PREFIX/*" "/demo/*" --query 'Invalidation.Id' --output text)
  log "DONE — shipped to https://$DOMAIN/$PREFIX/ and https://$DOMAIN/$PREFIX/?demo  (invalidation $INVALIDATION_ID)"
  exit 0
```

Also update the usage comment at the top of the file: `--ship` is now "build + upload editor & demo + invalidate".

- [ ] **Step 2: Sanity-check the staging logic locally (no AWS)**

Run:
```bash
DEMO_STAGE="$(mktemp -d)" && cp -r docs/specpad/. "$DEMO_STAGE/" && rm -f "$DEMO_STAGE/index.html" && ( cd "$DEMO_STAGE" && node -e 'const fs=require("fs");const documents=fs.readdirSync(".").filter((f)=>/\.(srs|vtp|proj)\.json$/.test(f));fs.writeFileSync("manifest.json",JSON.stringify({documents},null,2));' ) && ls -la "$DEMO_STAGE" && cat "$DEMO_STAGE/manifest.json" && find "$DEMO_STAGE/.specpad" -type f && rm -rf "$DEMO_STAGE"
```
Expected: stage contains `manifest.json` (3 documents), `specpad.{proj,srs,vtp,releases,job}.json`, `.specpad/baseline/*` and `.specpad/snapshots/v0.1/*`, and NO `index.html`.

Also run: `bash -n infra/deploy.sh`
Expected: no syntax errors.

- [ ] **Step 3: Document in `infra/README.md`**

Add to the README's site/redeploy notes: demo content lives at `https://specpad.com/demo/` (uploaded from `docs/specpad/` by `--ship`, manifest generated at upload), and the live demo URL is `https://specpad.com/v01/?demo`.

- [ ] **Step 4: Commit**

```bash
git add infra/deploy.sh infra/README.md
git commit -m "infra: ship dogfood spec to /demo/ with generated manifest"
```

---

### Task 8: Final verification and PR

- [ ] **Step 1: Full local verification**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all clean. If anything fails, fix before proceeding (superpowers:verification-before-completion).

- [ ] **Step 2: Real-app check**

Run `npm run dev`, open `http://localhost:5173/?demo`, and confirm end-to-end: project auto-loads, redlines show on the VTP view (baseline differs from working copy), version chip opens the history dialog, Testing view renders, status bar shows the demo badge and validation summary, no write affordances anywhere. Also confirm the normal path is untouched: open `http://localhost:5173/` and check the welcome/recent-projects screen still appears.

- [ ] **Step 3: Push and open the PR**

Use superpowers:finishing-a-development-branch. PR title: `feat(editor): read-only demo mode serving the dogfood spec`. The PR body should note: demo URL after next ship is `https://specpad.com/v01/?demo`; demo content is public; Plan 2 (landing page + reference) follows.

- [ ] **Step 4: After merge, ship and verify live (user-visible deploy — confirm with Geoff first)**

Run: `infra/deploy.sh --ship`, then check `https://specpad.com/v01/?demo` loads the demo and `https://specpad.com/v01/` still behaves normally.

---

## Self-review notes

- **Spec coverage (Plan 1 scope):** spec §6 editor demo mode ✓ (Tasks 1–4), §6 prep 1 (snapshots) — already committed in repo, nothing to do ✓, prep 2 (job marker + live redlines) ✓ (Task 5; redlines are live because the working SRS/VTP already differ from the v1.0 baseline), prep 3 (dogfood SRS/VTP update) ✓ (Task 6), §8 item 3 demo upload + invalidation ✓ (Task 7), §10 demo-mode tests ✓ (Tasks 1–3). Landing page, reference, skill zip, CloudFront apex change → Plan 2.
- **Type consistency:** `classifyDocFilename`, `enableDemoMode('/demo/')`, `openDemoProject()` return shape `{ name, documents }`, `demo?: boolean` props — consistent across Tasks 1–3.
- **Known judgment call:** demo keeps tables editable (visitors can play) but all persistence is blocked; the unload warning is suppressed in demo so casual visitors aren't nagged.
