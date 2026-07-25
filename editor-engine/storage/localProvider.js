const DB_NAME = "launchly.storage";
const DB_VERSION = 1;
const STORE_NAME = "blobs";

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = (event) => { dbInstance = event.target.result; resolve(dbInstance); };
    request.onerror = () => reject(request.error);
  });
}

export function readLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    if (e.name === "QuotaExceededError") {
      cleanupLocalStorage();
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
    }
    return false;
  }
}

export function removeLocal(key) {
  try { localStorage.removeItem(key); } catch {}
}

export function getLocalUsage() {
  let bytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    bytes += (key?.length ?? 0) + (localStorage.getItem(key)?.length ?? 0);
  }
  return { bytes, keys: localStorage.length, estimated: bytes * 2 };
}

export async function readBlob(storeKey) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(storeKey);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function writeBlob(storeKey, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(value, storeKey);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function removeBlob(storeKey) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(storeKey);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function clearBlobs() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getBlobUsage() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAllKeys();
    req.onsuccess = () => resolve({ keys: req.result?.length ?? 0 });
    req.onerror = () => resolve({ keys: 0 });
  });
}

export function cleanupLocalStorage() {
  const priorities = [
    "launchly.editor.project.v1",
    "launchly.editor.recovery.v1",
    "launchly.editor.errors.v1",
    "launchly.editor.sync.v1",
    "launchly.editor.userTemplates.v1",
  ];
  priorities.forEach((key) => { try { localStorage.removeItem(key); } catch {} });
}

export async function estimateQuota() {
  if (navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, percent: ((estimate.usage ?? 0) / (estimate.quota ?? 1)) * 100 };
    } catch {}
  }
  const local = getLocalUsage();
  return { usage: local.estimated, quota: 5 * 1024 * 1024, percent: (local.estimated / (5 * 1024 * 1024)) * 100 };
}
