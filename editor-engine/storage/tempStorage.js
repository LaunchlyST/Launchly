const TEMP_PREFIX = "launchly.tmp.";

export function createTempStorage(options = {}) {
  const { defaultTtlMs = 30 * 60 * 1000, maxTempFiles = 50 } = options;

  return {
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

    remove(key) {
      try { localStorage.removeItem(`${TEMP_PREFIX}${key}`); } catch {}
    },

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

      const remaining = this.list();
      if (remaining.length > maxTempFiles) {
        const toRemove = remaining.slice(0, remaining.length - maxTempFiles);
        toRemove.forEach((blob) => {
          try { localStorage.removeItem(blob.key); removedCount++; freedBytes += blob.size ?? 0; } catch {}
        });
      }

      return { removedCount, freedBytes };
    },

    getStats() {
      const items = this.list();
      let totalBytes = 0;
      items.forEach((item) => { totalBytes += item.size ?? 0; });
      return { count: items.length, totalBytes, maxFiles: maxTempFiles };
    },

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
