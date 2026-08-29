import { readLocal, writeLocal, removeLocal, getLocalUsage, readBlob, writeBlob, removeBlob, clearBlobs, getBlobUsage, estimateQuota } from "./localProvider.js";
import { createCacheProvider } from "./cacheProvider.js";
import { createTempStorage } from "./tempStorage.js";
import { createCloudProvider, createS3Provider, createGCSProvider, createAzureProvider, createCloudflareProvider, createSupabaseProvider } from "./cloudProvider.js";

export const STORAGE_NAMESPACES = Object.freeze(["project", "media", "thumbnail", "proxy", "error", "sync", "settings", "temp"]);

export function createStorageEngine(options = {}) {
  const { storageLimitMB = 12, autoCleanup = true } = options;

  const cache = createCacheProvider({ defaultLimit: 300 });
  const temp = createTempStorage({ defaultTtlMs: 30 * 60 * 1000, maxTempFiles: 50 });

  cache.createCache("project", { limit: 50 });
  cache.createCache("media", { limit: 200 });
  cache.createCache("thumbnail", { limit: 500, ttlMs: 60 * 60 * 1000 });
  cache.createCache("proxy", { limit: 50 });

  const cloudProviders = new Map();
  let activeCloudId = "local";

  const providers = [
    createCloudProvider(),
    createS3Provider(),
    createGCSProvider(),
    createAzureProvider(),
    createCloudflareProvider(),
    createSupabaseProvider(),
  ];
  providers.forEach((p) => cloudProviders.set(p.id, p));

  return {
    cache,
    temp,
    cloudProviders,

    async read(namespace, key, options = {}) {
      const cached = cache.read(namespace, key);
      if (cached !== undefined) return cached;

      if (options.blob) {
        const blob = await readBlob(`${namespace}:${key}`);
        if (blob !== null) { cache.write(namespace, key, blob); return blob; }
      } else {
        const local = readLocal(`${namespace}.${key}`);
        if (local !== null) { cache.write(namespace, key, local); return local; }
      }

      const cloud = cloudProviders.get(activeCloudId);
      if (cloud && cloud.isConnected && activeCloudId !== "local") {
        try {
          const data = await cloud.download(`${namespace}/${key}`);
          if (data !== null) { cache.write(namespace, key, data); return data; }
        } catch {}
      }

      return null;
    },

    async write(namespace, key, value, options = {}) {
      cache.write(namespace, key, value, options);

      let localSuccess = false;
      if (options.blob) {
        localSuccess = await writeBlob(`${namespace}:${key}`, value);
      } else {
        localSuccess = writeLocal(`${namespace}.${key}`, value);
      }

      const cloud = cloudProviders.get(activeCloudId);
      if (cloud && cloud.isConnected && activeCloudId !== "local" && options.cloudSync !== false) {
        try { await cloud.upload(`${namespace}/${key}`, value, options); } catch {}
      }

      return localSuccess;
    },

    async remove(namespace, key, options = {}) {
      cache.remove(namespace, key);
      if (options.blob) await removeBlob(`${namespace}:${key}`);
      else removeLocal(`${namespace}.${key}`);

      const cloud = cloudProviders.get(activeCloudId);
      if (cloud && cloud.isConnected && activeCloudId !== "local") {
        try { await cloud.delete(`${namespace}/${key}`); } catch {}
      }
    },

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

    async cleanup() {
      let totalFreed = 0;

      const tempResult = temp.cleanup();
      totalFreed += tempResult.freedBytes;

      const cacheResult = cache.cleanup();
      totalFreed += cacheResult.freedBytes;

      const info = await this.getStorageInfo();
      if (info.isOverLimit && autoCleanup) {
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
