import { createStorageEngine, STORAGE_NAMESPACES } from "../storage/storageEngine.js";
import { createCacheProvider, estimateBytes } from "../storage/cacheProvider.js";
import { createTempStorage } from "../storage/tempStorage.js";
import { createCloudProvider, createS3Provider, CLOUD_PROVIDER_IDS } from "../storage/cloudProvider.js";

if (typeof globalThis.localStorage === "undefined") {
  const store = new Map();
  globalThis.localStorage = {
    getItem(key) { return store.get(key) ?? null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    get length() { return store.size; },
    key(i) { return [...store.keys()][i] ?? null; },
  };
}

if (typeof globalThis.indexedDB === "undefined") {
  const idbStore = new Map();
  const fakeDB = {
    objectStoreNames: { contains() { return true; } },
    transaction(storeName, mode) {
      return {
        objectStore(storeName) {
          return {
            get(key) { const req = { onsuccess: null, onerror: null, result: idbStore.get(key) ?? null }; queueMicrotask(() => req.onsuccess?.()); return req; },
            put(value, key) { idbStore.set(key, value); const req = { onsuccess: null, onerror: null }; queueMicrotask(() => req.onsuccess?.()); return req; },
            delete(key) { idbStore.delete(key); const req = { onsuccess: null, onerror: null }; queueMicrotask(() => req.onsuccess?.()); return req; },
            clear() { idbStore.clear(); const req = { onsuccess: null, onerror: null }; queueMicrotask(() => req.onsuccess?.()); return req; },
            getAllKeys() { const req = { onsuccess: null, onerror: null, result: [...idbStore.keys()] }; queueMicrotask(() => req.onsuccess?.()); return req; },
          };
        },
      };
    },
  };
  globalThis.indexedDB = {
    open() {
      const req = { onsuccess: null, onerror: null, onupgradeneeded: null, result: fakeDB };
      queueMicrotask(() => { req.onupgradeneeded?.({ target: { result: fakeDB } }); req.onsuccess?.({ target: { result: fakeDB } }); });
      return req;
    },
  };
}

const storage = createStorageEngine({ storageLimitMB: 12 });

// ── StorageEngine basics ──

if (!STORAGE_NAMESPACES.includes("project")) throw new Error("STORAGE_NAMESPACES missing project");
if (!STORAGE_NAMESPACES.includes("media")) throw new Error("STORAGE_NAMESPACES missing media");
if (!STORAGE_NAMESPACES.includes("thumbnail")) throw new Error("STORAGE_NAMESPACES missing thumbnail");

await storage.write("project", "test-key", { name: "Test Project" });
const readBack = await storage.read("project", "test-key");
if (!readBack || readBack.name !== "Test Project") throw new Error("storage read/write roundtrip failed");

await storage.remove("project", "test-key");
const removed = await storage.read("project", "test-key");
if (removed !== null) throw new Error("storage remove did not delete entry");

// ── Cache provider ──

const cache = createCacheProvider({ defaultLimit: 10 });
cache.createCache("test", { limit: 5 });
cache.write("test", "a", "value-a");
cache.write("test", "b", "value-b");
if (cache.read("test", "a") !== "value-a") throw new Error("cache read failed");
if (cache.read("test", "nonexistent") !== undefined) throw new Error("cache read undefined key should return undefined");
cache.remove("test", "a");
if (cache.read("test", "a") !== undefined) throw new Error("cache remove failed");

cache.write("test", "c", "value-c");
cache.write("test", "d", "value-d");
cache.write("test", "e", "value-e");
cache.write("test", "f", "value-f");
cache.write("test", "g", "value-g");
if (cache.read("test", "b") !== undefined) throw new Error("cache LRU eviction did not work");

const stats = cache.getStats();
if (!stats.test) throw new Error("cache getStats missing test cache");
if (stats.test.entries > 5) throw new Error("cache entries exceed limit");

cache.clearAll();
if (cache.read("test", "c") !== undefined) throw new Error("cache clearAll failed");

// ── Cache TTL ──

const ttlCache = createCacheProvider({ defaultLimit: 10 });
ttlCache.write("ttl", "key", "data", { ttlMs: 1 });
await new Promise((r) => setTimeout(r, 10));
if (ttlCache.read("ttl", "key") !== undefined) throw new Error("cache TTL expiration failed");

// ── Cache tag removal ──

const tagCache = createCacheProvider({ defaultLimit: 10 });
tagCache.write("tags", "a", "1", { tags: ["project-1"] });
tagCache.write("tags", "b", "2", { tags: ["project-1"] });
tagCache.write("tags", "c", "3", { tags: ["project-2"] });
tagCache.removeByTag("tags", "project-1");
if (tagCache.read("tags", "a") !== undefined) throw new Error("removeByTag removed wrong entry");
if (tagCache.read("tags", "c") !== "3") throw new Error("removeByTag removed unrelated entry");

// ── estimateBytes ──

if (estimateBytes(null) !== 0) throw new Error("estimateBytes null should be 0");
if (estimateBytes("hello") !== 10) throw new Error("estimateBytes string wrong");
if (estimateBytes(42) !== 8) throw new Error("estimateBytes number wrong");
if (estimateBytes(true) !== 4) throw new Error("estimateBytes boolean wrong");

// ── Temp storage ──

const temp = createTempStorage({ defaultTtlMs: 60000, maxTempFiles: 5 });
temp.write("snap-1", { data: "snapshot" });
temp.write("snap-2", { data: "snapshot2" });
const tempRead = temp.read("snap-1");
if (!tempRead || !tempRead.data || tempRead.data.data !== "snapshot") throw new Error("temp write/read roundtrip failed");
const list = temp.list();
if (list.length < 2) throw new Error("temp list failed");
temp.remove("snap-1");
if (temp.read("snap-1") !== null) throw new Error("temp remove failed");

// ── Temp cleanup ──

temp.write("expired", { data: "old" }, { ttlMs: 1 });
await new Promise((r) => setTimeout(r, 10));
const cleanupResult = temp.cleanup();
if (cleanupResult.removedCount < 1) throw new Error("temp cleanup did not remove expired");

// ── Temp project cleanup ──

temp.write("proj-a", { data: "a" }, { projectId: "p1" });
temp.write("proj-b", { data: "b" }, { projectId: "p2" });
const projCleanup = temp.cleanupProject("p1");
if (projCleanup.removedCount !== 1) throw new Error("cleanupProject removed wrong count");

// ── Temp stats ──

const tempStats = temp.getStats();
if (typeof tempStats.count !== "number") throw new Error("temp getStats missing count");

// ── Cloud providers ──

const cloud = createCloudProvider();
if (cloud.id !== "local") throw new Error("default cloud provider should be local");
if (cloud.isConnected) throw new Error("cloud provider should not be connected by default");
if (!CLOUD_PROVIDER_IDS.includes("s3")) throw new Error("CLOUD_PROVIDER_IDS missing s3");
if (!CLOUD_PROVIDER_IDS.includes("gcs")) throw new Error("CLOUD_PROVIDER_IDS missing gcs");
if (!CLOUD_PROVIDER_IDS.includes("azure")) throw new Error("CLOUD_PROVIDER_IDS missing azure");
if (!CLOUD_PROVIDER_IDS.includes("cloudflare")) throw new Error("CLOUD_PROVIDER_IDS missing cloudflare");
if (!CLOUD_PROVIDER_IDS.includes("supabase")) throw new Error("CLOUD_PROVIDER_IDS missing supabase");

// ── Cloud provider operations ──

const stubCloud = createS3Provider();
const uploadResult = await stubCloud.upload("key", "data");
if (uploadResult.status !== "stub") throw new Error("cloud upload should return stub status");
const downloadResult = await stubCloud.download("key");
if (downloadResult !== null) throw new Error("cloud download stub should return null");
const deleteResult = await stubCloud.delete("key");
if (deleteResult !== true) throw new Error("cloud delete stub should return true");
const listResult = await stubCloud.list("prefix");
if (!Array.isArray(listResult)) throw new Error("cloud list stub should return array");
const usageResult = await stubCloud.getUsage();
if (typeof usageResult.bytes !== "number") throw new Error("cloud getUsage stub should return bytes");

// ── StorageEngine cloud management ──

const providers = storage.listCloudProviders();
if (!providers.length) throw new Error("listCloudProviders should return providers");
if (!providers.find((p) => p.id === "local")) throw new Error("listCloudProviders missing local");

storage.setActiveCloudProvider("s3");
const active = storage.getActiveCloudProvider();
if (active.id !== "s3") throw new Error("setActiveCloudProvider failed");

storage.setActiveCloudProvider("local");
const restored = storage.getActiveCloudProvider();
if (restored.id !== "local") throw new Error("setActiveCloudProvider restore failed");

const connectResult = storage.connectCloudProvider("s3", { bucket: "test" });
if (!connectResult) throw new Error("connectCloudProvider should return true");
const disconnectResult = storage.disconnectCloudProvider("s3");
if (!disconnectResult) throw new Error("disconnectCloudProvider should return true");
const badConnect = storage.connectCloudProvider("nonexistent", {});
if (badConnect) throw new Error("connectCloudProvider nonexistent should return false");

// ── StorageEngine info and stats ──

const info = await storage.getStorageInfo();
if (!info.local) throw new Error("getStorageInfo missing local");
if (!info.quota) throw new Error("getStorageInfo missing quota");
if (!info.cache) throw new Error("getStorageInfo missing cache");
if (!info.temp) throw new Error("getStorageInfo missing temp");
if (typeof info.percentUsed !== "number") throw new Error("getStorageInfo missing percentUsed");
if (typeof info.isOverLimit !== "boolean") throw new Error("getStorageInfo missing isOverLimit");

const statsResult = await storage.getStats();
if (typeof statsResult.totalEntries !== "number") throw new Error("getStats missing totalEntries");
if (typeof statsResult.totalCacheBytes !== "number") throw new Error("getStats missing totalCacheBytes");

// ── StorageEngine cleanup ──

const cleanupRes = await storage.cleanup();
if (typeof cleanupRes.freedBytes !== "number") throw new Error("cleanup missing freedBytes");
if (typeof cleanupRes.tempRemoved !== "number") throw new Error("cleanup missing tempRemoved");
if (typeof cleanupRes.cacheEvicted !== "boolean") throw new Error("cleanup missing cacheEvicted");
if (typeof cleanupRes.isStillOverLimit !== "boolean") throw new Error("cleanup missing isStillOverLimit");

// ── EditorCore storage integration ──

const { EditorCore } = await import("../core/editorCore.js");
const editor = new EditorCore({ fps: 30, duration: 60 });
const testStorage = createStorageEngine({ storageLimitMB: 12 });
editor.setStorageEngine(testStorage);
const engine = editor.getStorageEngine();
if (!engine) throw new Error("getStorageEngine returned null");
const editorInfo = await editor.getStorageInfo();
if (!editorInfo.local) throw new Error("getStorageInfo from editor failed");
const editorStats = await editor.getStorageStats();
if (typeof editorStats !== "object") throw new Error("getStorageStats from editor failed");
const editorCleanup = await editor.cleanupStorage();
if (typeof editorCleanup.freedBytes !== "number") throw new Error("cleanupStorage from editor failed");
const editorProviders = editor.listCloudProviders();
if (!editorProviders.length) throw new Error("listCloudProviders from editor failed");
editor.setActiveCloudProvider("gcs");
editor.connectCloudProvider("gcs", { key: "test" });
editor.disconnectCloudProvider("gcs");

console.log("All storage system tests passed.");
