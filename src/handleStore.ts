/**
 * Persists opened project folders (FileSystemDirectoryHandle) in IndexedDB so
 * return visits can reopen without re-navigating the picker.
 *
 * Folders are deduped by real identity via `isSameEntry`, never by name — two
 * different repos can share a project name, and the same folder must not produce
 * duplicate entries. Degrades to a no-op where IndexedDB is unavailable
 * (e.g. Firefox/Safari), so callers can always call it safely.
 *
 * `now` is passed in by the caller so the module stays pure and testable.
 */
const DB_NAME = 'specpad';
const DB_VERSION = 1;
const STORE = 'recentProjects';

export interface RecentProject {
  id: number;
  handle: FileSystemDirectoryHandle;
  dirName: string; // handle.name — the picked folder's leaf name
  dir?: string; // launcher-provided local folder path (correlation hint)
  projectNames: string[]; // <name>.proj.json names found inside
  lastOpenedAt: number;
}

export function isSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      })
  );
}

export async function listRecent(): Promise<RecentProject[]> {
  if (!isSupported()) return [];
  try {
    const all = await run<RecentProject[]>('readonly', (s) => s.getAll());
    return all.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  } catch {
    return [];
  }
}

export async function rememberProject(
  handle: FileSystemDirectoryHandle,
  meta: { dir?: string; projectNames: string[]; now: number }
): Promise<void> {
  if (!isSupported()) return;
  const existing = await listRecent();
  for (const r of existing) {
    try {
      if (await handle.isSameEntry(r.handle)) {
        await run('readwrite', (s) =>
          s.put({
            ...r,
            handle,
            dirName: handle.name,
            dir: meta.dir ?? r.dir,
            projectNames: meta.projectNames,
            lastOpenedAt: meta.now,
          })
        );
        return;
      }
    } catch {
      /* a stale handle can throw here; skip it */
    }
  }
  await run('readwrite', (s) =>
    s.add({
      handle,
      dirName: handle.name,
      dir: meta.dir,
      projectNames: meta.projectNames,
      lastOpenedAt: meta.now,
    })
  );
}

export async function forgetProject(id: number): Promise<void> {
  if (!isSupported()) return;
  try {
    await run('readwrite', (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}
