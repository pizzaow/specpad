/**
 * Local transport — the File System Access API (Chrome/Edge; Firefox/Safari fall back
 * to upload/download in the shell). The developer's mode: the user picks their own
 * clone's docs/specpad/ folder and edits it in place.
 */
import type { SpecPadDoc } from '../shared';
import type { FileApi, DocumentListItem } from './types';
import { classifyDocFilename, parseDocument, projectNameFrom } from './types';

declare global {
  interface Window {
    showOpenFilePicker?: (options?: any) => Promise<any[]>;
    showDirectoryPicker?: (options?: any) => Promise<any>;
  }
}

export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window || 'showOpenFilePicker' in window;
}

export class LocalTransport implements FileApi {
  readonly readOnly = false;
  private dirHandle: FileSystemDirectoryHandle | null = null;
  private name = '';

  projectName(): string {
    return this.name;
  }

  isOpen(): boolean {
    return this.dirHandle !== null;
  }

  getDirHandle(): FileSystemDirectoryHandle | null {
    return this.dirHandle;
  }

  async listDocuments(): Promise<DocumentListItem[]> {
    if (!this.dirHandle) return [];
    const documents: DocumentListItem[] = [];
    for await (const entry of (this.dirHandle as any).values()) {
      if (entry.kind !== 'file') continue;
      const item = classifyDocFilename(entry.name);
      if (item) documents.push(item);
    }
    return documents;
  }

  async readJson(path: string[]): Promise<SpecPadDoc | null> {
    const handle = await this.fileHandle(path);
    if (!handle) return null;
    return parseDocument(await (await handle.getFile()).text());
  }

  async readText(path: string[]): Promise<string | null> {
    try {
      const handle = await this.fileHandle(path);
      if (!handle) return null;
      return await (await handle.getFile()).text();
    } catch {
      // Any resolution failure — including a name the API rejects as invalid — is
      // treated as absent, so one bad reference cannot abort opening the project.
      return null;
    }
  }

  async writeText(path: string[], content: string): Promise<void> {
    await this.requestWritePermission();
    const segments = normalize(path);
    const filename = segments.pop();
    if (!filename) throw new Error('No filename given');
    let dir: any = this.dirHandle;
    for (const seg of segments) dir = await dir.getDirectoryHandle(seg, { create: true });
    const fileHandle = await dir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(content);
      await writable.close();
    } catch (err) {
      await writable.abort();
      throw err;
    }
  }

  /** Request read/write permission before a write that needs it (a user gesture). */
  async requestWritePermission(): Promise<void> {
    if (!this.dirHandle) throw new Error('No directory selected');
    const permission = await (this.dirHandle as any).requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') throw new Error('Write permission not granted');
  }

  // ---- Opening a project (picker flows; not part of the transport contract) ----

  async openDirectory(): Promise<{ name: string; documents: DocumentListItem[] }> {
    if (!window.showDirectoryPicker) throw new Error('File System Access API not supported');
    try {
      this.dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
        id: 'specpad',
      });
      const documents = await this.listDocuments();
      const proj = documents.find((d) => d.type === 'proj');
      if (proj) {
        this.name = proj.name;
      } else {
        const name = prompt('Enter project name:');
        if (!name) throw new Error('Project name is required');
        this.name = name;
      }
      return { name: this.name, documents };
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new Error('Directory selection cancelled');
      throw err;
    }
  }

  async openFile(): Promise<{ name: string; documents: DocumentListItem[] }> {
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
      this.name = match[1];
      this.dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
        id: 'specpad',
      });
      return { name: this.name, documents: await this.listDocuments() };
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new Error('File selection cancelled');
      throw err;
    }
  }

  /** Reopen from a previously-granted directory handle (no picker). */
  async openFromHandle(
    handle: FileSystemDirectoryHandle,
  ): Promise<{ name: string; documents: DocumentListItem[] }> {
    this.dirHandle = handle;
    const documents = await this.listDocuments();
    this.name = projectNameFrom(documents) || handle.name;
    return { name: this.name, documents };
  }

  // ---- Internals ----

  /** Resolve path segments to a file handle; null when any segment is missing. */
  private async fileHandle(path: string[]): Promise<any | null> {
    if (!this.dirHandle) return null;
    const segments = normalize(path);
    const filename = segments.pop();
    if (!filename) return null;
    let dir: any = this.dirHandle;
    for (const seg of segments) {
      try {
        dir = await dir.getDirectoryHandle(seg);
      } catch {
        return null;
      }
    }
    try {
      return await dir.getFileHandle(filename);
    } catch (err: any) {
      if (err?.name === 'NotFoundError') return null;
      throw err;
    }
  }
}

/** Flatten "a/b" segments and drop no-op "." parts, so callers may pass either form. */
function normalize(path: string[]): string[] {
  return path.flatMap((p) => p.split('/')).filter((s) => s && s !== '.');
}

/**
 * Check (and optionally request) read/write permission on a stored handle.
 * Request must be triggered from a user gesture; query is always silent.
 */
export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  request: boolean,
): Promise<boolean> {
  const h = handle as any;
  const opts = { mode: 'readwrite' };
  if ((await h.queryPermission(opts)) === 'granted') return true;
  if (request && (await h.requestPermission(opts)) === 'granted') return true;
  return false;
}
