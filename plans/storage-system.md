# Storage System — Implementation Plan

## Goal
Create a unified storage abstraction over the existing scattered localStorage/in-memory caches. Add quota monitoring, cleanup, temporary files, and a cloud-ready provider interface. No cloud APIs — architecture only.

---

## Current State

| Layer | Type | Persistence | Eviction | Limit |
|-------|------|-------------|----------|-------|
| localStorage (9 keys) | Browser localStorage | Page refresh | None | ~5MB |
| `createCache()` | In-memory Map | None | LRU | 200 |
| `createFrameCache()` | In-memory Map | None | LRU | 90-120 |
| `createThumbnails()` | In-memory Map | None | None | Unlimited |
| `mediaEngine.mediaCache` | Plain object | None | None | Unlimited |
| `settings.storageLimit` | UI-only | Never enforced | — | 2-50 slider |

**Gaps**: No quota monitoring, no eviction, no cleanup, no IndexedDB, no cloud abstraction, storage limit setting is decorative.

---

## Architecture

```
editor-engine/storage/
  storageEngine.js          ← central orchestrator, quota monitoring, cleanup
  localProvider.js          ← localStorage + IndexedDB abstraction
  cacheProvider.js          ← in-memory LRU caches (project, media, thumbnail)
  tempStorage.js            ← temporary file management with auto-cleanup
  cloudProvider.js          ← abstract cloud interface (stub for future providers)
```

### Flow

```
StorageEngine.write("project", key, data)
  → localProvider.write(key, data)
    → check quota → serialize → localStorage.setItem / IndexedDB.put

StorageEngine.read("thumbnail", assetId)
  → cacheProvider.read("thumbnail", assetId)
    → hit? return : miss → localProvider.read() → cacheProvider.write() → return

StorageEngine.cleanup()
  → scan all providers → evict expired → enforce limits → report freed bytes
```

---

## File-by-File Plan

### 1. `editor-engine/storage/localProvider.js`

Unified localStorage + IndexedDB abstraction.

```js
const DB_NAME = "launchly.storage";
const DB_VERSION = 1;
const STORE_NAME = " blobs";

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

// ─── localStorage wrapper ───

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
      // Try cleanup and retry once
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
  return { bytes, keys: localStorage.length, estimated: bytes * 2 }; // UTF-16 = 2 bytes/char
}

// ─── IndexedDB wrapper (for blobs/large data) ───

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

// ─── Cleanup ───

function cleanupLocalStorage() {
  // Remove legacy/lowest-priority keys first
  const priorities = [
    "launchly.editor.project.v1",           // legacy
    "launchly.editor.recovery.v1",          // recovery (regenerable)
    "launchly.editor.errors.v1",            // error logs
    "launchly.editor.sync.v1",              // sync state
    "launchly.editor.userTemplates.v1",     // user templates
  ];
  priorities.forEach((key) => {
    try { localStorage.removeItem(key); } catch {}
  });
}

// ─── Quota estimation ───

export async function estimateQuota() {
  if (navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, percent: ((estimate.usage ?? 0) / (estimate.quota ?? 1)) * 100 };
    } catch {}
  }
  return { usage: getLocalUsage().estimated, quota: 5 * 1024 * 1024, percent: (getLocalUsage().estimated / (5 * 1024 * 1024)) * 100 };
}
```

### 2. `editor-engine/storage/cacheProvider.js`

Named cache instances with LRU eviction, size tracking, and TTL.

```js
import { createId } from "../types/editorTypes.js";

export function createCacheProvider(options = {}) {
  const { defaultLimit = 200, defaultTtlMs = 0 } = options;
  const caches = new Map();

  function ensureCache(name, config = {}) {
    if (!caches.has(name)) {
      caches.set(name, {
        entries: new Map(),
        limit: config.limit ?? defaultLimit,
        ttlMs: config.ttlMs ?? defaultTtlMs,
        totalBytes: 0,
      });
    }
    return caches.get(name);
  }

  return {
    caches,

    // ─── CRUD ───

    write(cacheName, key, value, options = {}) {
      const cache = ensureCache(cacheName, options);
      // Remove old entry if exists
      const old = cache.entries.get(key);
      if (old) cache.totalBytes -= (old.bytes ?? 0);

      const bytes = estimateBytes(value);
      const entry = {
        value,
        bytes,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        ttlMs: options.ttlMs ?? cache.ttlMs,
        tags: options.tags ?? [],
      };
      cache.entries.delete(key);
      cache.entries.set(key, entry);
      cache.totalBytes += bytes;

      // Evict LRU if over limit
      while (cache.entries.size > cache.limit) {
        const oldest = cache.entries.keys().next().value;
        const evicted = cache.entries.get(oldest);
        cache.totalBytes -= (evicted?.bytes ?? 0);
        cache.entries.delete(oldest);
      }
      return entry;
    },

    read(cacheName, key) {
      const cache = caches.get(cacheName);
      if (!cache) return undefined;
      const entry = cache.entries.get(key);
      if (!entry) return undefined;
      // Check TTL
      if (entry.ttlMs > 0 && (Date.now() - entry.createdAt) > entry.ttlMs) {
        cache.totalBytes -= (entry.bytes ?? 0);
        cache.entries.delete(key);
        return undefined;
      }
      // LRU touch
      entry.lastAccessedAt = Date.now();
      cache.entries.delete(key);
      cache.entries.set(key, entry);
      return entry.value;
    },

    remove(cacheName, key) {
      const cache = caches.get(cacheName);
      if (!cache) return;
      const entry = cache.entries.get(key);
      if (entry) cache.totalBytes -= (entry.bytes ?? 0);
      cache.entries.delete(key);
    },

    clear(cacheName, key) {
      if (key) return this.remove(cacheName, key);
      const cache = caches.get(cacheName);
      if (cache) { cache.totalBytes = 0; cache.entries.clear(); }
    },

    clearAll() {
      caches.forEach((cache) => { cache.totalBytes = 0; cache.entries.clear(); });
    },

    // ─── Cleanup ───

    cleanup() {
      let freedBytes = 0;
      caches.forEach((cache) => {
        const before = cache.entries.size;
        // Remove expired entries
        for (const [key, entry] of cache.entries) {
          if (entry.ttlMs > 0 && (Date.now() - entry.createdAt) > entry.ttlMs) {
            cache.totalBytes -= (entry.bytes ?? 0);
            cache.entries.delete(key);
          }
        }
        freedBytes += (before - cache.entries.size) * 100; // estimate
      });
      return { freedBytes, caches: caches.size };
    },

    // ─── Stats ───

    getStats() {
      const stats = {};
      caches.forEach((cache, name) => {
        stats[name] = {
          entries: cache.entries.size,
          limit: cache.limit,
          totalBytes: cache.totalBytes,
          utilizationPercent: Math.round((cache.entries.size / cache.limit) * 100),
        };
      });
      return stats;
    },

    getTotalBytes() {
      let total = 0;
      caches.forEach((cache) => { total += cache.totalBytes; });
      return total;
    },

    // ─── Tag-based operations ───

    removeByTag(cacheName, tag) {
      const cache = caches.get(cacheName);
      if (!cache) return;
      for (const [key, entry] of cache.entries) {
        if (entry.tags?.includes(tag)) {
          cache.totalBytes -= (entry.bytes ?? 0);
          cache.entries.delete(key);
        }
      }
    },
  };
}

function estimateBytes(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string") return value.length * 2;
  if (typeof value === "number") return 8;
  if (typeof value === "boolean") return 4;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + estimateBytes(item), 0);
  if (typeof value === "object") {
    let bytes = 0;
    for (const key in value) bytes += (key.length * 2) + estimateBytes(value[key]);
    return bytes;
  }
  return 0;
}
```

### 3. `editor-engine/storage/tempStorage.js`

Temporary file management with auto-cleanup.

```js
const TEMP_PREFIX = "launchly.tmp.";

export function createTempStorage(options = {}) {
  const { defaultTtlMs = 30 * 60 * 1000, maxTempFiles = 50 } = options; // 30 min default

  return {
    // ─── Write ───

    write(key, data, options = {}) {
      const ttlMs = options.ttlMs ?? defaultTtlMs;
      const blob = {
        key: `${TEMP_PREFIX}${key}`,
        data,
        size: estimateBytes(data),
        createdAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
        purpose: options.purpose ?? "general",
        projectId: options.projectId ?? null,
      };
      try {
        localStorage.setItem(blob.key, JSON.stringify(blob));
        return true;
      } catch { return false; }
    },

    // ─── Read ───

    read(key) {
      try {
        const raw = localStorage.getItem(`${TEMP_PREFIX}${key}`);
        if (!raw) return null;
        const blob = JSON.parse(raw);
        if (Date.now() > blob.expiresAt) {
          this.remove(key);
          return null;
        }
        return blob;
      } catch { return null; }
    },

    // ─── Remove ───

    remove(key) {
      try { localStorage.removeItem(`${TEMP_PREFIX}${key}`); } catch {}
    },

    // ─── List ───

    list(options = {}) {
      const items = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(TEMP_PREFIX)) continue;
        try {
          const blob = JSON.parse(localStorage.getItem(key));
          if (options.purpose && blob.purpose !== options.purpose) continue;
          if (options.projectId && blob.projectId !== options.projectId) continue;
          items.push(blob);
        } catch {}
      }
      return items.sort((a, b) => a.createdAt - b.createdAt);
    },

    // ─── Cleanup ───

    cleanup() {
      const now = Date.now();
      let freedBytes = 0;
      let removedCount = 0;
      const keysToRemove = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(TEMP_PREFIX)) continue;
        try {
          const blob = JSON.parse(localStorage.getItem(key));
          if (now > blob.expiresAt) {
            keysToRemove.push(key);
            freedBytes += blob.size ?? 0;
          }
        } catch { keysToRemove.push(key); }
      }

      keysToRemove.forEach((key) => {
        try { localStorage.removeItem(key); removedCount++; } catch {}
      });

      // Enforce max temp files
      const remaining = this.list();
      if (remaining.length > maxTempFiles) {
        const toRemove = remaining.slice(0, remaining.length - maxTempFiles);
        toRemove.forEach((blob) => {
          try { localStorage.removeItem(blob.key); removedCount++; freedBytes += blob.size ?? 0; } catch {}
        });
      }

      return { removedCount, freedBytes };
    },

    // ─── Stats ───

    getStats() {
      const items = this.list();
      let totalBytes = 0;
      items.forEach((item) => { totalBytes += item.size ?? 0; });
      return { count: items.length, totalBytes, maxFiles: maxTempFiles };
    },

    // ─── Project-scoped cleanup ───

    cleanupProject(projectId) {
      const items = this.list({ projectId });
      let freedBytes = 0;
      items.forEach((blob) => {
        try { localStorage.removeItem(blob.key); freedBytes += blob.size ?? 0; } catch {}
      });
      return { removedCount: items.length, freedBytes };
    },
  };
}

function estimateBytes(value) {
  if (typeof value === "string") return value.length * 2;
  if (typeof value === "object") return JSON.stringify(value).length * 2;
  return 0;
}
```

### 4. `editor-engine/storage/cloudProvider.js`

Abstract cloud storage interface for future providers.

```js
export const CLOUD_PROVIDER_IDS = Object.freeze(["local", "s3", "gcs", "azure", "cloudflare", "supabase"]);

export function createCloudProvider(config = {}) {
  return {
    id: config.id ?? "local",
    name: config.name ?? "Local Storage",
    type: config.type ?? "local",   // "local" | "object" | "cdn"
    isConnected: false,
    capabilities: config.capabilities ?? ["read", "write", "delete", "list"],
    config: {},
  };
}

// Each cloud provider must implement:
// connect(storedConfig) → validates, sets isConnected
// disconnect() → clears config
// upload(key, data, options) → { url, bytes, status }
// download(key) → data
// delete(key) → boolean
// list(prefix) → [{ key, size, updatedAt }]
// getUsage() → { bytes, objects }
// getSignedUrl(key, expiresIn) → url (optional)

export function createS3Provider() {
  return {
    ...createCloudProvider({ id: "s3", name: "AWS S3", type: "object" }),
    connect(storedConfig) { this.config = storedConfig; this.isConnected = true; },
    disconnect() { this.config = {}; this.isConnected = false; },
    async upload(key, data, options) { return { url: `s3://${key}`, bytes: 0, status: "stub" }; },
    async download(key) { return null; },
    async delete(key) { return true; },
    async list(prefix) { return []; },
    async getUsage() { return { bytes: 0, objects: 0 }; },
  };
}

export function createGCSProvider() {
  return {
    ...createCloudProvider({ id: "gcs", name: "Google Cloud Storage", type: "object" }),
    connect(storedConfig) { this.config = storedConfig; this.isConnected = true; },
    disconnect() { this.config = {}; this.isConnected = false; },
    async upload(key, data, options) { return { url: `gs://${key}`, bytes: 0, status: "stub" }; },
    async download(key) { return null; },
    async delete(key) { return true; },
    async list(prefix) { return []; },
    async getUsage() { return { bytes: 0, objects: 0 }; },
  };
}

export function createAzureProvider() {
  return {
    ...createCloudProvider({ id: "azure", name: "Azure Blob Storage", type: "object" }),
    connect(storedConfig) { this.config = storedConfig; this.isConnected = true; },
    disconnect() { this.config = {}; this.isConnected = false; },
    async upload(key, data, options) { return { url: `az://${key}`, bytes: 0, status: "stub" }; },
    async download(key) { return null; },
    async delete(key) { return true; },
    async list(prefix) { return []; },
    async getUsage() { return { bytes: 0, objects: 0 }; },
  };
}

export function createCloudflareProvider() {
  return {
    ...createCloudProvider({ id: "cloudflare", name: "Cloudflare R2", type: "cdn" }),
    connect(storedConfig) { this.config = storedConfig; this.isConnected = true; },
    disconnect() { this.config = {}; this.isConnected = false; },
    async upload(key, data, options) { return { url: `r2://${key}`, bytes: 0, status: "stub" }; },
    async download(key) { return null; },
    async delete(key) { return true; },
    async list(prefix) { return []; },
    async getUsage() { return { bytes: 0, objects: 0 }; },
  };
}

export function createSupabaseProvider() {
  return {
    ...createCloudProvider({ id: "supabase", name: "Supabase Storage", type: "object" }),
    connect(storedConfig) { this.config = storedConfig; this.isConnected = true; },
    disconnect() { this.config = {}; this.isConnected = false; },
    async upload(key, data, options) { return { url: `supabase://${key}`, bytes: 0, status: "stub" }; },
    async download(key) { return null; },
    async delete(key) { return true; },
    async list(prefix) { return []; },
    async getUsage() { return { bytes: 0, objects: 0 }; },
  };
}
```

### 5. `editor-engine/storage/storageEngine.js`

Central orchestrator. Unifies all providers, manages quotas, coordinates cleanup.

```js
import { readLocal, writeLocal, removeLocal, getLocalUsage, readBlob, writeBlob, removeBlob, clearBlobs, getBlobUsage, estimateQuota } from "./localProvider.js";
import { createCacheProvider } from "./cacheProvider.js";
import { createTempStorage } from "./tempStorage.js";
import { createCloudProvider, createS3Provider, createGCSProvider, createAzureProvider, createCloudflareProvider, createSupabaseProvider } from "./cloudProvider.js";

export const STORAGE_NAMESPACES = Object.freeze(["project", "media", "thumbnail", "proxy", "error", "sync", "settings", "temp"]);

export function createStorageEngine(options = {}) {
  const { storageLimitMB = 12, autoCleanup = true } = options;

  const cache = createCacheProvider({ defaultLimit: 300 });
  const temp = createTempStorage({ defaultTtlMs: 30 * 60 * 1000, maxTempFiles: 50 });

  // Pre-create named caches with appropriate limits
  cache.createCache("project", { limit: 50 });
  cache.createCache("media", { limit: 200 });
  cache.createCache("thumbnail", { limit: 500, ttlMs: 60 * 60 * 1000 }); // 1hr TTL
  cache.createCache("proxy", { limit: 50 });

  const cloudProviders = new Map();
  let activeCloudId = "local";

  // Register built-in cloud providers
  function registerDefaultCloudProviders() {
    const providers = [
      createCloudProvider(),  // local (default)
      createS3Provider(),
      createGCSProvider(),
      createAzureProvider(),
      createCloudflareProvider(),
      createSupabaseProvider(),
    ];
    providers.forEach((p) => cloudProviders.set(p.id, p));
  }
  registerDefaultCloudProviders();

  return {
    cache,
    temp,
    cloudProviders,

    // ─── Unified Read ───

    async read(namespace, key, options = {}) {
      // Try cache first
      const cached = cache.read(namespace, key);
      if (cached !== undefined) return cached;

      // Try local storage
      if (options.blob) {
        const blob = await readBlob(`${namespace}:${key}`);
        if (blob !== null) { cache.write(namespace, key, blob); return blob; }
      } else {
        const local = readLocal(`${namespace}.${key}`);
        if (local !== null) { cache.write(namespace, key, local); return local; }
      }

      // Try active cloud provider
      const cloud = cloudProviders.get(activeCloudId);
      if (cloud && cloud.isConnected && activeCloudId !== "local") {
        try {
          const data = await cloud.download(`${namespace}/${key}`);
          if (data !== null) { cache.write(namespace, key, data); return data; }
        } catch {}
      }

      return null;
    },

    // ─── Unified Write ───

    async write(namespace, key, value, options = {}) {
      // Write to cache
      cache.write(namespace, key, value, options);

      // Write to local storage
      let localSuccess = false;
      if (options.blob) {
        localSuccess = await writeBlob(`${namespace}:${key}`, value);
      } else {
        localSuccess = writeLocal(`${namespace}.${key}`, value);
      }

      // Write to cloud if connected
      const cloud = cloudProviders.get(activeCloudId);
      if (cloud && cloud.isConnected && activeCloudId !== "local" && options.cloudSync !== false) {
        try { await cloud.upload(`${namespace}/${key}`, value, options); } catch {}
      }

      return localSuccess;
    },

    // ─── Unified Remove ───

    async remove(namespace, key, options = {}) {
      cache.remove(namespace, key);
      if (options.blob) await removeBlob(`${namespace}:${key}`);
      else removeLocal(`${namespace}.${key}`);

      const cloud = cloudProviders.get(activeCloudId);
      if (cloud && cloud.isConnected && activeCloudId !== "local") {
        try { await cloud.delete(`${namespace}/${key}`); } catch {}
      }
    },

    // ─── Quota & Limits ───

    async getStorageInfo() {
      const local = getLocalUsage();
      const blob = await getBlobUsage();
      const quota = await estimateQuota();
      const cacheStats = cache.getStats();
      const tempStats = temp.getStats();
      const limitBytes = storageLimitMB * 1024 * 1024;

      return {
        local,
        blob,
        quota,
        cache: cacheStats,
        temp: tempStats,
        limitBytes,
        limitMB: storageLimitMB,
        percentUsed: Math.round((local.estimated / limitBytes) * 100),
        isOverLimit: local.estimated > limitBytes,
        cloud: activeCloudId !== "local" ? cloudProviders.get(activeCloudId)?.id : null,
      };
    },

    // ─── Cleanup ───

    async cleanup(options = {}) {
      let totalFreed = 0;

      // 1. Clean expired temp files
      const tempResult = temp.cleanup();
      totalFreed += tempResult.freedBytes;

      // 2. Clean expired cache entries
      const cacheResult = cache.cleanup();
      totalFreed += cacheResult.freedBytes;

      // 3. If over limit, evict oldest cache entries
      const info = await this.getStorageInfo();
      if (info.isOverLimit && autoCleanup) {
        // Evict 20% of thumbnail cache (least recently used)
        const thumbCache = cache.caches.get("thumbnail");
        if (thumbCache) {
          const toEvict = Math.ceil(thumbCache.limit * 0.2);
          for (let i = 0; i < toEvict && thumbCache.entries.size > 0; i++) {
            const oldest = thumbCache.entries.keys().next().value;
            const evicted = thumbCache.entries.get(oldest);
            thumbCache.totalBytes -= (evicted?.bytes ?? 0);
            thumbCache.entries.delete(oldest);
            totalFreed += evicted?.bytes ?? 0;
          }
        }
      }

      return {
        freedBytes: totalFreed,
        tempRemoved: tempResult.removedCount,
        cacheEvicted: cacheResult.freedBytes > 0,
        isStillOverLimit: (await this.getStorageInfo()).isOverLimit,
      };
    },

    // ─── Cloud Management ───

    setActiveCloudProvider(providerId) {
      if (cloudProviders.has(providerId)) activeCloudId = providerId;
    },

    getActiveCloudProvider() {
      return cloudProviders.get(activeCloudId);
    },

    listCloudProviders() {
      return [...cloudProviders.values()].map((p) => ({
        id: p.id, name: p.name, type: p.type, isConnected: p.isConnected, capabilities: p.capabilities,
      }));
    },

    connectCloudProvider(providerId, config) {
      const provider = cloudProviders.get(providerId);
      if (!provider) return false;
      provider.connect(config);
      return true;
    },

    disconnectCloudProvider(providerId) {
      const provider = cloudProviders.get(providerId);
      if (!provider) return false;
      provider.disconnect();
      return true;
    },

    // ─── Stats ───

    async getStats() {
      const info = await this.getStorageInfo();
      return {
        ...info,
        totalEntries: Object.values(info.cache).reduce((sum, c) => sum + (c.entries ?? 0), 0),
        totalCacheBytes: Object.values(info.cache).reduce((sum, c) => sum + (c.totalBytes ?? 0), 0),
      };
    },
  };
}
```

### 6. Update `editor-engine/constants/editorConstants.js`

Add storage domain:
```js
export const EDITOR_DOMAINS = Object.freeze({
  // ... existing
  storage: "storage",
});

export const STORAGE_NAMESPACES = Object.freeze([
  "project", "media", "thumbnail", "proxy", "error", "sync", "settings", "temp",
]);
```

### 7. Update `editor-engine/index.js`

Add new exports:
```js
export * from "./storage/storageEngine.js";
export * from "./storage/localProvider.js";
export * from "./storage/cacheProvider.js";
export * from "./storage/tempStorage.js";
export * from "./storage/cloudProvider.js";
```

### 8. Update `editor-engine/core/editorCore.js`

Add storage methods.

**New state field** (in `createDefaultState`):
```js
storage: null,  // initialized lazily by createStorageEngine
```

**New methods on EditorCore**:
```js
// Storage
getStorageEngine() → storageEngine instance
getStorageInfo() → { local, blob, quota, cache, temp, limitBytes, percentUsed, isOverLimit }
cleanupStorage() → { freedBytes, tempRemoved, cacheEvicted }
getStorageStats() → { ...info, totalEntries, totalCacheBytes }

// Cloud
listCloudProviders() → [{ id, name, type, isConnected, capabilities }]
setActiveCloudProvider(providerId) → void
connectCloudProvider(providerId, config) → boolean
disconnectCloudProvider(providerId) → boolean
```

### 9. Update `app.js`

Replace scattered localStorage operations with storage engine calls.

**Storage initialization** (after editor creation):
```js
import { createStorageEngine } from "./editor-engine/storage/storageEngine.js";
const storageEngine = createStorageEngine({ storageLimitMB: settings.storageLimit ?? 12 });
```

**Replace `persistProjectLibrary()`**:
```js
function persistProjectLibrary() {
  projectLibrary.sort((a, b) => new Date(b.lastOpenedAt ?? b.updatedAt) - new Date(a.lastOpenedAt ?? a.updatedAt));
  storageEngine.write("project", "library", projectLibrary);
  storageEngine.write("project", "folders", projectFolders);
  if (activeProjectId) storageEngine.write("project", "activeId", activeProjectId);
}
```

**Replace bootstrap reads**:
```js
projectLibrary = (await storageEngine.read("project", "library")) ?? [];
projectFolders = (await storageEngine.read("project", "folders")) ?? [];
recoverySnapshots = (await storageEngine.read("project", "recovery")) ?? [];
```

**Replace settings persistence**:
```js
function saveSettings() {
  storageEngine.write("settings", "all", settings);
}
```

**Replace error persistence**:
```js
function persistErrorState() {
  storageEngine.write("error", "state", editor.state.errors);
}
```

**Replace sync persistence**:
```js
function persistSyncState() {
  storageEngine.write("sync", "architecture", syncSnapshot());
}
```

**Storage settings panel update**:
```js
storage: `
  <div class="settings-section-head"><strong>Storage</strong><span>Manage local and cloud storage.</span></div>
  <div class="settings-grid">
    ${settingsField("Storage Limit", "storageLimit", '<input data-setting type="range" min="2" max="50" value="' + settings.storageLimit + '" />')}
    ${settingsField("Thumbnail Cache", "thumbnailCache", `<input data-setting type="checkbox" ${settingChecked("thumbnailCache")} />`)}
    ${settingsField("Auto Cleanup", "autoCleanup", `<input data-setting type="checkbox" ${settingChecked("autoCleanup")} />`)}
    <div class="settings-storage-meter" data-storage-meter></div>
  </div>
`,
```

**Render storage meter** (async):
```js
async function renderStorageMeter() {
  const meter = document.querySelector("[data-storage-meter]");
  if (!meter) return;
  const info = await storageEngine.getStorageInfo();
  meter.innerHTML = `
    <strong>Local cache</strong>
    <span>${(info.local.estimated / 1024).toFixed(1)} KB / ${info.limitMB} MB (${info.percentUsed}%)</span>
    <div class="storage-bar"><div class="storage-fill" style="width:${Math.min(100, info.percentUsed)}%"></div></div>
    ${info.isOverLimit ? '<span class="storage-warning">Over limit — cleanup recommended</span>' : ''}
    <button data-action="cleanup-storage">Clean Up</button>
  `;
}
```

**Auto-cleanup on startup**:
```js
if (settings.autoCleanup !== false) {
  storageEngine.cleanup().then((result) => {
    if (result.freedBytes > 0) console.log(`Storage cleanup: freed ${result.freedBytes} bytes`);
  });
}
```

### 10. Update `styles.css`

Add storage meter styles:
```css
.storage-bar {
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.storage-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, rgba(191, 238, 255, 0.6), rgba(157, 231, 198, 0.6));
  transition: width 0.3s ease;
}

.storage-warning {
  color: #ff8888;
  font-size: 11px;
  font-weight: 700;
}
```

---

## Storage Hierarchy

```
┌─────────────────────────────────────────┐
│           StorageEngine                │
│  ┌───────────┐  ┌──────────────────┐   │
│  │  Cache     │  │  LocalProvider   │   │
│  │  Provider  │  │  ┌────────────┐ │   │
│  │            │  │  │ localStorage│ │   │
│  │ project:50 │  │  └────────────┘ │   │
│  │ media:200  │  │  ┌────────────┐ │   │
│  │ thumb:500  │  │  │ IndexedDB  │ │   │
│  │ proxy:50   │  │  └────────────┘ │   │
│  └───────────┘  └──────────────────┘   │
│  ┌───────────┐  ┌──────────────────┐   │
│  │   Temp    │  │  CloudProvider   │   │
│  │  Storage  │  │  (future stubs)  │   │
│  │ auto-expire│ │  S3/GCS/Azure/   │   │
│  │ max 50    │  │  CF/Supabase     │   │
│  └───────────┘  └──────────────────┘   │
└─────────────────────────────────────────┘
```

---

## What This Does NOT Do
- No real cloud API calls (all stubs return `"stub"` status)
- No actual image/media transcoding for thumbnails
- No file system access (stays in browser storage)
- No encryption of stored data

## What This DOES Do
- Unified read/write/remove API across all storage layers
- LRU cache with configurable limits per namespace (project/media/thumbnail/proxy)
- TTL-based cache expiration (thumbnails expire after 1 hour)
- IndexedDB for blob/large data storage alongside localStorage
- Temporary file system with auto-cleanup (30min default TTL, 50 file max)
- Quota monitoring via `navigator.storage.estimate()` with fallback
- Storage limit enforcement (configurable 2-50 MB, default 12 MB)
- Auto-cleanup when over limit (evicts 20% of oldest cache entries)
- 6 cloud provider stubs ready for future integration (S3, GCS, Azure, R2, Supabase)
- Cloud provider selection and connection management
- Byte-level tracking across all layers
- Storage info dashboard with usage meter
- Project-scoped temp cleanup
- Tag-based cache eviction
