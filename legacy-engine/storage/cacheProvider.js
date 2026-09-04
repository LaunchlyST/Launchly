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

    createCache(name, config = {}) {
      ensureCache(name, config);
      return caches.get(name);
    },

    write(cacheName, key, value, options = {}) {
      const cache = ensureCache(cacheName, options);
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
      if (entry.ttlMs > 0 && (Date.now() - entry.createdAt) > entry.ttlMs) {
        cache.totalBytes -= (entry.bytes ?? 0);
        cache.entries.delete(key);
        return undefined;
      }
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

    cleanup() {
      let freedBytes = 0;
      caches.forEach((cache) => {
        const before = cache.entries.size;
        for (const [key, entry] of cache.entries) {
          if (entry.ttlMs > 0 && (Date.now() - entry.createdAt) > entry.ttlMs) {
            cache.totalBytes -= (entry.bytes ?? 0);
            cache.entries.delete(key);
          }
        }
        freedBytes += (before - cache.entries.size) * 100;
      });
      return { freedBytes, caches: caches.size };
    },

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

export function estimateBytes(value) {
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
