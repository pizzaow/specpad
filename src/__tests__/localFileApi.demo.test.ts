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
