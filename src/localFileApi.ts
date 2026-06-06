/**
 * Local File API — File System Access API wrapper (schema-agnostic transport).
 * Naming convention: [name].[type].json (e.g. AcmeApp.srs.json).
 * Chrome/Edge: full support. Firefox/Safari: fallback upload/download.
 */

import type { ProjectDoc, SrsDoc, VtpDoc, SpecPadDoc } from './shared';
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

export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window || 'showOpenFilePicker' in window;
}

/** Pure helpers — unit-tested without the File System Access API. */
export function serializeDocument(doc: SpecPadDoc): string {
  return JSON.stringify(doc, null, 2) + '\n';
}

export function parseDocument(text: string): SpecPadDoc {
  return JSON.parse(text) as SpecPadDoc;
}

async function listDocumentsInDirectory(): Promise<DocumentListItem[]> {
  if (!projectDirHandle) throw new Error('No directory selected');
  const documents: DocumentListItem[] = [];
  for await (const entry of (projectDirHandle as any).values()) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
    const srs = entry.name.match(/^(.+?)\.srs\.json$/);
    const vtp = entry.name.match(/^(.+?)\.vtp\.json$/);
    const proj = entry.name.match(/^(.+?)\.proj\.json$/);
    if (srs) documents.push({ type: 'srs', name: srs[1], filename: entry.name });
    else if (vtp) documents.push({ type: 'vtp', name: vtp[1], filename: entry.name });
    else if (proj) documents.push({ type: 'proj', name: proj[1], filename: entry.name });
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
  return projectDirHandle !== null;
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
