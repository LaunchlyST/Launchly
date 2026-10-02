import type { ConnectedProject } from './types';

/**
 * Real local project connections via the File System Access API.
 *
 * A website cannot read arbitrary folders on someone's computer — Chromium
 * browsers expose `window.showDirectoryPicker()`, which opens the OS folder
 * picker and hands back a handle only for the folder the user explicitly
 * chose. The handle (and nothing else — never file contents) is stored in
 * IndexedDB so the project is still there after a reload; the browser makes
 * the app re-ask for permission on each new session, which we do lazily via
 * `queryPermission`/`requestPermission` rather than assuming access.
 */

const DB_NAME = 'launchly-monitor';
const STORE = 'local-projects';

export function supportsLocalProjects(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

interface StoredLocalProject {
  id: string;
  name: string;
  branch: string;
  handle: FileSystemDirectoryHandle;
  createdAt: string;
}

/** Best-effort branch name from `.git/HEAD` in the chosen folder — never guessed. */
async function readGitBranch(dir: FileSystemDirectoryHandle): Promise<string> {
  try {
    const gitDir = await dir.getDirectoryHandle('.git');
    const headFile = await gitDir.getFileHandle('HEAD');
    const text = await (await headFile.getFile()).text();
    const m = text.trim().match(/ref:\s*refs\/heads\/(.+)$/);
    return m ? m[1] : 'detached';
  } catch {
    return 'local';
  }
}

export function toConnectedProject(p: StoredLocalProject): ConnectedProject {
  return { id: p.id, source: 'local', name: p.name, repository: p.name, branch: p.branch, status: 'synced' };
}

export async function listLocalProjects(): Promise<ConnectedProject[]> {
  if (!supportsLocalProjects()) return [];
  try {
    const rows = await withStore<StoredLocalProject[]>('readonly', (s) => s.getAll());
    return rows.map(toConnectedProject);
  } catch {
    return [];
  }
}

/** Opens the OS folder picker. Resolves to null if the user cancels. */
export async function connectLocalProject(): Promise<ConnectedProject | null> {
  if (!supportsLocalProjects()) throw new Error('Connecting a local folder needs Chrome or Edge on desktop.');
  let handle: FileSystemDirectoryHandle;
  try {
    handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
  const branch = await readGitBranch(handle);
  const record: StoredLocalProject = { id: crypto.randomUUID(), name: handle.name, branch, handle, createdAt: new Date().toISOString() };
  await withStore('readwrite', (s) => s.put(record));
  return toConnectedProject(record);
}

export type LocalPermission = 'granted' | 'needed' | 'unavailable';

/** Checks (without prompting) whether we still have access to a stored project's folder. */
export async function checkLocalPermission(id: string): Promise<LocalPermission> {
  const handle = await getHandle(id);
  if (!handle) return 'unavailable';
  try {
    const state = await (handle as any).queryPermission({ mode: 'readwrite' });
    return state === 'granted' ? 'granted' : 'needed';
  } catch {
    return 'unavailable';
  }
}

/** Re-asks for permission. Must run inside a user gesture (click handler). */
export async function restoreLocalPermission(id: string): Promise<LocalPermission> {
  const handle = await getHandle(id);
  if (!handle) return 'unavailable';
  try {
    const state = await (handle as any).requestPermission({ mode: 'readwrite' });
    return state === 'granted' ? 'granted' : 'needed';
  } catch {
    return 'unavailable';
  }
}

export async function getHandle(id: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    const row = await withStore<StoredLocalProject | undefined>('readonly', (s) => s.get(id));
    return row?.handle ?? null;
  } catch {
    return null;
  }
}

export async function removeLocalProject(id: string): Promise<void> {
  try {
    await withStore('readwrite', (s) => s.delete(id));
  } catch {
    /* nothing to clean up */
  }
}

export function isLocalProjectId(projects: ConnectedProject[], id: string): boolean {
  return projects.some((p) => p.id === id && p.source === 'local');
}
