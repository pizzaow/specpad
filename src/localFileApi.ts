/**
 * Local File API — File System Access API wrapper (schema-agnostic transport).
 * Naming convention: [name].[type].json (e.g. AcmeApp.srs.json).
 * Chrome/Edge: full support. Firefox/Safari: fallback upload/download.
 */

import type { ProjectDoc, SrsDoc, VtpDoc, SpecPadDoc, ReleasesDoc, JobDoc, JobsDoc, JobCommit, SidecarDoc } from './shared';
import { createSrsDoc, createVtpDoc } from './shared';

declare global {
  interface Window {
    showOpenFilePicker?: (options?: any) => Promise<any[]>;
    showDirectoryPicker?: (options?: any) => Promise<any>;
  }
}

export type DocKind = 'srs' | 'vtp' | 'proj';

export interface DocumentListItem {
  type: DocKind;
  name: string;
  filename: string;
}

let projectDirHandle: FileSystemDirectoryHandle | null = null;
let projectName = '';

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
  projectName = '';
}

export function isDemoMode(): boolean {
  return demoBaseUrl !== null;
}

async function fetchDemoJson(relPath: string): Promise<SpecPadDoc | null> {
  if (!demoBaseUrl) throw new Error('Demo mode is not enabled');
  const res = await fetch(demoBaseUrl + relPath, { cache: 'no-cache' });
  // S3 behind CloudFront OAC has GetObject but not ListBucket, so missing keys
  // come back 403 AccessDenied, not 404. Both mean "absent" for optional files.
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Demo fetch failed (HTTP ${res.status}): ${relPath}`);
  return parseDocument(await res.text());
}

/** Open the hosted demo project: fetch the manifest and classify its documents. */
export async function openDemoProject(): Promise<{ name: string; documents: DocumentListItem[] }> {
  if (!demoBaseUrl) throw new Error('Demo mode is not enabled');
  const res = await fetch(`${demoBaseUrl}manifest.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load the demo manifest (HTTP ${res.status})`);
  const manifest = (await res.json()) as { documents: string[] };
  if (!Array.isArray(manifest.documents)) {
    throw new Error('Demo manifest is malformed: missing "documents" array');
  }
  demoDocuments = manifest.documents
    .map(classifyDocFilename)
    .filter((d): d is DocumentListItem => d !== null);
  const projFile = demoDocuments.find((d) => d.type === 'proj');
  projectName = projFile ? projFile.name : (demoDocuments[0]?.name ?? '');
  return { name: projectName, documents: demoDocuments };
}

export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window || 'showOpenFilePicker' in window;
}

/** Pure helpers — unit-tested without the File System Access API. */
export function serializeDocument(doc: SpecPadDoc | SidecarDoc): string {
  return JSON.stringify(doc, null, 2) + '\n';
}

export function parseDocument(text: string): SpecPadDoc {
  return JSON.parse(text) as SpecPadDoc;
}

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

export async function openProjectDirectory(): Promise<{ name: string; documents: DocumentListItem[] }> {
  if (!window.showDirectoryPicker) throw new Error('File System Access API not supported');
  try {
    projectDirHandle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents', id: 'specpad' });
    const documents = await listDocumentsInDirectory();
    const projFile = documents.find((d) => d.type === 'proj');
    if (projFile) {
      projectName = projFile.name;
    } else {
      const name = prompt('Enter project name:');
      if (!name) throw new Error('Project name is required');
      projectName = name;
    }
    return { name: projectName, documents };
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('Directory selection cancelled');
    throw err;
  }
}

export async function openProjectFile(): Promise<{ name: string; documents: DocumentListItem[] }> {
  if (!window.showOpenFilePicker || !window.showDirectoryPicker) {
    throw new Error('File System Access API not supported');
  }
  try {
    const [fileHandle] = await window.showOpenFilePicker({
      types: [{ description: 'Project Files', accept: { 'application/json': ['.proj.json'] } }],
      multiple: false,
      startIn: 'documents',
      id: 'specpad',
    });
    const file = await fileHandle.getFile();
    const match = file.name.match(/^(.+?)\.proj\.json$/);
    if (!match) throw new Error('Expected a [name].proj.json file');
    projectName = match[1];
    projectDirHandle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents', id: 'specpad' });
    const documents = await listDocumentsInDirectory();
    return { name: projectName, documents };
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('File selection cancelled');
    throw err;
  }
}

export async function listDocuments(): Promise<DocumentListItem[]> {
  if (demoBaseUrl) return demoDocuments;
  if (!projectDirHandle) return [];
  return listDocumentsInDirectory();
}

/** Reopen a project from a previously-granted directory handle (no picker). */
export async function openProjectFromHandle(
  handle: FileSystemDirectoryHandle
): Promise<{ name: string; documents: DocumentListItem[] }> {
  projectDirHandle = handle;
  const documents = await listDocumentsInDirectory();
  const projFile = documents.find((d) => d.type === 'proj');
  projectName = projFile ? projFile.name : handle.name;
  return { name: projectName, documents };
}

/** The currently-open directory handle, for persisting to the recent-projects store. */
export function getDirHandle(): FileSystemDirectoryHandle | null {
  return projectDirHandle;
}

/**
 * Check (and optionally request) read/write permission on a stored handle.
 * Request must be triggered from a user gesture; query is always silent.
 */
export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  request: boolean
): Promise<boolean> {
  const h = handle as any;
  const opts = { mode: 'readwrite' };
  if ((await h.queryPermission(opts)) === 'granted') return true;
  if (request && (await h.requestPermission(opts)) === 'granted') return true;
  return false;
}

async function readJson(filename: string): Promise<SpecPadDoc> {
  if (demoBaseUrl) {
    const doc = await fetchDemoJson(filename);
    if (!doc) throw new Error(`Document not found: ${filename}`);
    return doc;
  }
  if (!projectDirHandle) throw new Error('No directory selected');
  try {
    const fileHandle = await projectDirHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return parseDocument(await file.text());
  } catch (err: any) {
    if (err?.name === 'NotFoundError') throw new Error(`Document not found: ${filename}`);
    throw err;
  }
}

export async function loadProject(name: string): Promise<ProjectDoc> {
  return (await readJson(`${name}.proj.json`)) as ProjectDoc;
}

export async function loadDocument(type: 'srs', name: string): Promise<SrsDoc>;
export async function loadDocument(type: 'vtp', name: string): Promise<VtpDoc>;
export async function loadDocument(type: 'srs' | 'vtp', name: string): Promise<SrsDoc | VtpDoc> {
  return (await readJson(`${name}.${type}.json`)) as SrsDoc | VtpDoc;
}

export async function saveDocument(doc: SrsDoc | VtpDoc | ProjectDoc): Promise<void> {
  if (demoBaseUrl) throw new Error(READ_ONLY_DEMO);
  if (!projectDirHandle) throw new Error('No directory selected');
  const permission = await (projectDirHandle as any).requestPermission({ mode: 'readwrite' });
  if (permission !== 'granted') throw new Error('Write permission not granted');
  // The schema uses type 'project', but the filename suffix is 'proj'.
  const kind = doc.type === 'project' ? 'proj' : doc.type;
  const filename = `${doc.name}.${kind}.json`;
  const fileHandle = await projectDirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(serializeDocument(doc));
    await writable.close();
  } catch (err) {
    await writable.abort();
    throw err;
  }
}

export async function createNewDocument(
  name: string,
  title: string,
  type: 'srs' | 'vtp'
): Promise<SrsDoc | VtpDoc> {
  const doc = type === 'srs' ? createSrsDoc(name, title) : createVtpDoc(name, title);
  await saveDocument(doc);
  return doc;
}

export function getCurrentProjectName(): string {
  return projectName;
}

export function hasOpenDirectory(): boolean {
  return demoBaseUrl !== null || projectDirHandle !== null;
}

export async function openFileFallback(accept = '.json'): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) resolve(file);
      else reject(new Error('No file selected'));
    };
    input.click();
  });
}

export function saveFileFallback(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- Change-tracking cache loaders (manifest, job marker, snapshots) ----
// All return null when the file/dir is absent so the editor can show a degraded
// (no-history) state instead of erroring. The skill writes these; we only read
// (and write the job marker the user sets).

export type SnapshotLocation = 'baseline' | { version: string };

/** Pure: the .specpad path segments for a snapshot location. */
export function snapshotDirSegments(location: SnapshotLocation): string[] {
  return location === 'baseline'
    ? ['.specpad', 'baseline']
    : ['.specpad', 'snapshots', location.version];
}

/** Walk into a nested subdirectory of the open project; null if any segment is missing. */
async function getSubDirectory(segments: string[]): Promise<FileSystemDirectoryHandle | null> {
  if (!projectDirHandle) return null;
  let dir: any = projectDirHandle;
  for (const seg of segments) {
    try {
      dir = await dir.getDirectoryHandle(seg);
    } catch {
      return null;
    }
  }
  return dir as FileSystemDirectoryHandle;
}

async function readJsonFrom(
  dir: FileSystemDirectoryHandle,
  filename: string,
): Promise<SpecPadDoc | null> {
  try {
    const fh = await dir.getFileHandle(filename);
    return parseDocument(await (await fh.getFile()).text());
  } catch (err: any) {
    if (err?.name === 'NotFoundError') return null;
    throw err;
  }
}

/** Load the release manifest `<name>.releases.json`, or null if absent. */
export async function loadReleases(name: string): Promise<ReleasesDoc | null> {
  if (demoBaseUrl) return (await fetchDemoJson(`${name}.releases.json`)) as ReleasesDoc | null;
  if (!projectDirHandle) return null;
  return (await readJsonFrom(projectDirHandle, `${name}.releases.json`)) as ReleasesDoc | null;
}

/** Load the current-job marker `<name>.job.json`, or null if absent. */
export async function loadJob(name: string): Promise<JobDoc | null> {
  if (demoBaseUrl) return (await fetchDemoJson(`${name}.job.json`)) as JobDoc | null;
  if (!projectDirHandle) return null;
  return (await readJsonFrom(projectDirHandle, `${name}.job.json`)) as JobDoc | null;
}

/** Write the current-job marker `<name>.job.json`. */
export async function saveJob(name: string, doc: JobDoc): Promise<void> {
  if (demoBaseUrl) throw new Error(READ_ONLY_DEMO);
  if (!projectDirHandle) throw new Error('No directory selected');
  const fileHandle = await projectDirHandle.getFileHandle(`${name}.job.json`, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(serializeDocument(doc));
    await writable.close();
  } catch (err) {
    await writable.abort();
    throw err;
  }
}

/** Load the jobs register `<name>.jobs.json`, or null if absent. */
export async function loadJobs(name: string): Promise<JobsDoc | null> {
  if (demoBaseUrl) return (await fetchDemoJson(`${name}.jobs.json`)) as JobsDoc | null;
  if (!projectDirHandle) return null;
  return (await readJsonFrom(projectDirHandle, `${name}.jobs.json`)) as JobsDoc | null;
}

/** Write the jobs register `<name>.jobs.json`. */
export async function saveJobs(name: string, doc: JobsDoc): Promise<void> {
  if (demoBaseUrl) throw new Error(READ_ONLY_DEMO);
  if (!projectDirHandle) throw new Error('No directory selected');
  const fileHandle = await projectDirHandle.getFileHandle(`${name}.jobs.json`, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(serializeDocument(doc));
    await writable.close();
  } catch (err) {
    await writable.abort();
    throw err;
  }
}

/** Load a project text file (e.g. `<name>.sad.md`, `<name>.workspace.dsl`), or null if absent. */
export async function loadProjectText(filename: string): Promise<string | null> {
  if (demoBaseUrl) {
    const res = await fetch(demoBaseUrl + filename, { cache: 'no-cache' });
    if (!res.ok) return null;
    return res.text();
  }
  if (!projectDirHandle) return null;
  try {
    const fh = await projectDirHandle.getFileHandle(filename);
    return await (await fh.getFile()).text();
  } catch (err: any) {
    if (err?.name === 'NotFoundError') return null;
    throw err;
  }
}

/** Load a closed job's cached commit list (`.specpad/jobs/<id>/commits.json`), or [] if absent. */
export async function loadJobCommits(jobId: string): Promise<JobCommit[]> {
  const filename = 'commits.json';
  try {
    if (demoBaseUrl) {
      const res = await fetch(`${demoBaseUrl}.specpad/jobs/${jobId}/${filename}`, { cache: 'no-cache' });
      if (!res.ok) return [];
      return (await res.json()) as JobCommit[];
    }
    const dir = await getSubDirectory(['.specpad', 'jobs', jobId]);
    if (!dir) return [];
    const fh = await dir.getFileHandle(filename);
    return JSON.parse(await (await fh.getFile()).text()) as JobCommit[];
  } catch {
    return [];
  }
}

/** Load a cached closed-job snapshot doc (`.specpad/jobs/<id>/<before|after>/...`), or null. */
export async function loadJobSnapshot(
  jobId: string,
  state: 'before' | 'after',
  type: 'srs' | 'vtp' | 'proj',
  name: string,
): Promise<SpecPadDoc | null> {
  const segments = ['.specpad', 'jobs', jobId, state];
  if (demoBaseUrl) return fetchDemoJson(`${segments.join('/')}/${name}.${type}.json`);
  const dir = await getSubDirectory(segments);
  if (!dir) return null;
  return readJsonFrom(dir, `${name}.${type}.json`);
}

/** Load a cached snapshot doc (`.specpad/baseline/...` or `.specpad/snapshots/<version>/...`). */
export async function loadSnapshot(
  location: SnapshotLocation,
  type: 'srs' | 'vtp' | 'proj',
  name: string,
): Promise<SpecPadDoc | null> {
  if (demoBaseUrl) {
    return fetchDemoJson(`${snapshotDirSegments(location).join('/')}/${name}.${type}.json`);
  }
  const dir = await getSubDirectory(snapshotDirSegments(location));
  if (!dir) return null;
  return readJsonFrom(dir, `${name}.${type}.json`);
}
