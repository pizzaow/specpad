/**
 * The editor's document API — the one door every view goes through.
 *
 * This module owns SpecPad's file *conventions* (which filename holds the SRS, where a
 * snapshot lives, what "absent" means for an optional sidecar) and delegates every
 * actual read and write to the active `FileApi` transport: local files, the read-only
 * demo, or a SpecPad server (EDR-1). Swapping the transport swaps where the project
 * lives without any view knowing.
 */
import type {
  ProjectDoc,
  SrsDoc,
  VtpDoc,
  PrdDoc,
  SpecPadDoc,
  ReleasesDoc,
  JobDoc,
  JobsDoc,
  JobCommit,
  RunRecord,
} from './shared';
import { createSrsDoc, createVtpDoc } from './shared';
import type { FileApi, DocumentListItem, DocKind, SnapshotLocation } from './transports/types';
import {
  classifyDocFilename,
  serializeDocument,
  parseDocument,
  snapshotDirSegments,
} from './transports/types';
import { LocalTransport, isFileSystemAccessSupported, verifyPermission } from './transports/local';
import { DemoTransport, READ_ONLY_DEMO } from './transports/demo';
import { RemoteTransport, connectToServer, isProjectChoice } from './transports/remote';
import type {
  ServerSession,
  ProjectChoice,
  ProjectSummary,
  ServerStatus,
  CommitResult,
  ServerConflict,
  PendingChange,
  Presence,
  UpstreamMoved,
  ServerEventHandlers,
} from './transports/remote';

export type { FileApi, DocumentListItem, DocKind, SnapshotLocation };
export type {
  ServerSession,
  ProjectChoice,
  ProjectSummary,
  ServerStatus,
  CommitResult,
  ServerConflict,
  PendingChange,
  Presence,
  UpstreamMoved,
};
export { isProjectChoice };
export {
  classifyDocFilename,
  serializeDocument,
  parseDocument,
  snapshotDirSegments,
  isFileSystemAccessSupported,
  verifyPermission,
};

// ---- The active transport ----

const localTransport = new LocalTransport();
let demoTransport: DemoTransport | null = null;
let active: FileApi = localTransport;

/** Swap the active transport (used by demo mode and, later, remote/server mode). */
export function setTransport(transport: FileApi): void {
  active = transport;
}

export function getTransport(): FileApi {
  return active;
}

/** Enable read-only demo mode, reading from `baseUrl` (e.g. "/demo/"). */
export function enableDemoMode(baseUrl: string): void {
  demoTransport = new DemoTransport(baseUrl);
  active = demoTransport;
}

/** Reset demo mode (used by tests; a real session never leaves demo mode). */
export function disableDemoMode(): void {
  demoTransport = null;
  active = localTransport;
}

export function isDemoMode(): boolean {
  return demoTransport !== null;
}

/** Open the hosted demo project: fetch the manifest and classify its documents. */
export async function openDemoProject(): Promise<{ name: string; documents: DocumentListItem[] }> {
  if (!demoTransport) throw new Error('Demo mode is not enabled');
  return demoTransport.open();
}

// ---- Server (remote) mode ----

let remoteTransport: RemoteTransport | null = null;

/**
 * The API base for a project (MPT-3). Naming none addresses the deployment's only
 * project, which is what every single-project server — and every existing one — is.
 */
export function serverApiBase(projectId?: string): string {
  return projectId ? `/api/v1/p/${encodeURIComponent(projectId)}` : '/api/v1';
}

/**
 * Look for a SpecPad server serving this page and switch to it if there is one (MPT-9).
 *
 * Returns the session; null when the editor is running against local files; or the list
 * of projects to choose from when a multi-project server was reached without one being
 * named in the URL.
 */
export async function connectToSpecPadServer(
  projectId?: string,
): Promise<ServerSession | ProjectChoice | null> {
  const result = await connectToServer(serverApiBase(projectId));
  if (!result) return null;
  if (isProjectChoice(result)) return result;
  remoteTransport = result;
  active = result;
  return result.getSession();
}

export function isServerMode(): boolean {
  return remoteTransport !== null;
}

/** Reset server mode (tests only). */
export function disableServerMode(): void {
  remoteTransport = null;
  active = localTransport;
}

export function getServerSession(): ServerSession | null {
  return remoteTransport ? remoteTransport.getSession() : null;
}

function requireServer(): RemoteTransport {
  if (!remoteTransport) throw new Error('Not connected to a SpecPad server');
  return remoteTransport;
}

/** Open the project the server owns — no picker, the server chose it. */
export async function openServerProject(): Promise<{ name: string; documents: DocumentListItem[] }> {
  const transport = requireServer();
  return { name: transport.projectName(), documents: await transport.listDocuments() };
}

/** Pending (uncommitted) changes in this user's working copy — the Commit badge. */
export async function serverStatus(): Promise<ServerStatus> {
  return requireServer().status();
}

/** Publish this user's pending changes as one commit (CMT-3). */
export async function serverCommit(message: string): Promise<CommitResult> {
  return requireServer().commit(message);
}

/** Throw away this user's pending changes (CMT-7). */
export async function serverDiscard(): Promise<ServerStatus> {
  return requireServer().discard();
}

/** Subscribe to presence and upstream-moved events; no-op when not on a server (CE-3). */
export function serverSubscribe(handlers: ServerEventHandlers): () => void {
  if (!remoteTransport) return () => {};
  return remoteTransport.subscribeEvents(handlers);
}

/** Announce where this user is editing. Advisory: failures are ignored (CE-4). */
export async function serverClaimPresence(
  doc: string | null,
  itemId: string | null,
): Promise<void> {
  if (!remoteTransport) return;
  await remoteTransport.claimPresence(doc, itemId);
}

export async function serverReleasePresence(): Promise<void> {
  if (!remoteTransport) return;
  await remoteTransport.releasePresence();
}

// ---- Opening a local project ----

export async function openProjectDirectory(): Promise<{ name: string; documents: DocumentListItem[] }> {
  return localTransport.openDirectory();
}

export async function openProjectFile(): Promise<{ name: string; documents: DocumentListItem[] }> {
  return localTransport.openFile();
}

/** Reopen a project from a previously-granted directory handle (no picker). */
export async function openProjectFromHandle(
  handle: FileSystemDirectoryHandle,
): Promise<{ name: string; documents: DocumentListItem[] }> {
  return localTransport.openFromHandle(handle);
}

/** The currently-open directory handle, for persisting to the recent-projects store. */
export function getDirHandle(): FileSystemDirectoryHandle | null {
  return localTransport.getDirHandle();
}

export function getCurrentProjectName(): string {
  return active.projectName();
}

export function hasOpenDirectory(): boolean {
  return active.isOpen();
}

export async function listDocuments(): Promise<DocumentListItem[]> {
  return active.listDocuments();
}

/** Refuse a write the active transport cannot accept, in that transport's own terms. */
function assertWritable(): void {
  if (!active.readOnly) return;
  throw new Error(
    remoteTransport ? 'Your role does not permit editing this project.' : READ_ONLY_DEMO,
  );
}

// ---- Documents (required: absent is an error) ----

async function requireJson(filename: string): Promise<SpecPadDoc> {
  const doc = await active.readJson([filename]);
  if (!doc) throw new Error(`Document not found: ${filename}`);
  return doc;
}

export async function loadProject(name: string): Promise<ProjectDoc> {
  return (await requireJson(`${name}.proj.json`)) as ProjectDoc;
}

export async function loadDocument(type: 'srs', name: string): Promise<SrsDoc>;
export async function loadDocument(type: 'vtp', name: string): Promise<VtpDoc>;
export async function loadDocument(type: 'srs' | 'vtp', name: string): Promise<SrsDoc | VtpDoc> {
  return (await requireJson(`${name}.${type}.json`)) as SrsDoc | VtpDoc;
}

/** Load the optional PRD register `<name>.prd.json` (caller guards on its presence). */
export async function loadPrd(name: string): Promise<PrdDoc> {
  return (await requireJson(`${name}.prd.json`)) as PrdDoc;
}

export async function saveDocument(doc: SrsDoc | VtpDoc | PrdDoc | ProjectDoc): Promise<void> {
  assertWritable();
  // The schema uses type 'project', but the filename suffix is 'proj'.
  const kind = doc.type === 'project' ? 'proj' : doc.type;
  await active.writeText([`${doc.name}.${kind}.json`], serializeDocument(doc));
}

export async function createNewDocument(
  name: string,
  title: string,
  type: 'srs' | 'vtp',
): Promise<SrsDoc | VtpDoc> {
  const doc = type === 'srs' ? createSrsDoc(name, title) : createVtpDoc(name, title);
  await saveDocument(doc);
  return doc;
}

// ---- Sidecars and caches (optional: absent is null, so the editor degrades) ----

/** Load the release manifest `<name>.releases.json`, or null if absent. */
export async function loadReleases(name: string): Promise<ReleasesDoc | null> {
  return (await active.readJson([`${name}.releases.json`])) as ReleasesDoc | null;
}

/** Load the current-job marker `<name>.job.json`, or null if absent. */
export async function loadJob(name: string): Promise<JobDoc | null> {
  return (await active.readJson([`${name}.job.json`])) as JobDoc | null;
}

/** Write the current-job marker `<name>.job.json`. */
export async function saveJob(name: string, doc: JobDoc): Promise<void> {
  assertWritable();
  await active.writeText([`${name}.job.json`], serializeDocument(doc));
}

/** Load the jobs register `<name>.jobs.json`, or null if absent. */
export async function loadJobs(name: string): Promise<JobsDoc | null> {
  return (await active.readJson([`${name}.jobs.json`])) as JobsDoc | null;
}

/** Write the jobs register `<name>.jobs.json`. */
export async function saveJobs(name: string, doc: JobsDoc): Promise<void> {
  assertWritable();
  await active.writeText([`${name}.jobs.json`], serializeDocument(doc));
}

/** Write a project text file (e.g. `<name>.sad.md`, `<name>.workspace.dsl`). */
export async function saveProjectText(filename: string, content: string): Promise<void> {
  assertWritable();
  await active.writeText([filename], content);
}

/** Load a project text file (e.g. `<name>.sad.md`, `<name>.workspace.dsl`), or null if absent. */
export async function loadProjectText(filename: string): Promise<string | null> {
  return active.readText([filename]);
}

/** Load a text file from a closed job's cache (`.specpad/jobs/<id>/<state>/<filename>`), or null. */
export async function loadJobText(
  jobId: string,
  state: 'before' | 'after',
  filename: string,
): Promise<string | null> {
  return active.readText(['.specpad', 'jobs', jobId, state, filename]);
}

/** Load a closed job's cached commit list (`.specpad/jobs/<id>/commits.json`), or [] if absent. */
export async function loadJobCommits(jobId: string): Promise<JobCommit[]> {
  try {
    const text = await active.readText(['.specpad', 'jobs', jobId, 'commits.json']);
    return text ? (JSON.parse(text) as JobCommit[]) : [];
  } catch {
    return [];
  }
}

/** Load the latest captured verification run (`.specpad/run/<name>.run.json`), or null if none. */
export async function loadRun(name: string): Promise<RunRecord | null> {
  try {
    return (await active.readJson(['.specpad', 'run', `${name}.run.json`])) as RunRecord | null;
  } catch {
    return null;
  }
}

/** Load a cached closed-job snapshot doc (`.specpad/jobs/<id>/<before|after>/...`), or null. */
export async function loadJobSnapshot(
  jobId: string,
  state: 'before' | 'after',
  type: string, // any register/content doc type or 'proj' (registry-generic)
  name: string,
): Promise<SpecPadDoc | null> {
  return active.readJson(['.specpad', 'jobs', jobId, state, `${name}.${type}.json`]);
}

/** Load a cached snapshot doc (`.specpad/baseline/...` or `.specpad/snapshots/<version>/...`). */
export async function loadSnapshot(
  location: SnapshotLocation,
  type: string, // any register/content doc type or 'proj' (registry-generic)
  name: string,
): Promise<SpecPadDoc | null> {
  return active.readJson([...snapshotDirSegments(location), `${name}.${type}.json`]);
}

// ---- Browser fallbacks (Firefox/Safari have no File System Access API) ----

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
