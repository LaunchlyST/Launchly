/**
 * Two-level cache for Business Connect: a per-isolate in-memory map (free,
 * instant) in front of an optional durable store (the Supabase
 * `business_cache` table). Repeated searches and repeated opens of the same
 * business never re-hit OSM/Google or re-fetch a website within the TTL.
 */

export interface DurableStore {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

export const TTL = {
  search: 60 * 60 * 6, // 6h — business listings change slowly
  business: 60 * 60 * 24, // 24h
  website: 60 * 60 * 24 * 3, // 3 days — verified social links / emails
  profile: 60 * 60 * 12, // 12h
};

export class BusinessCache {
  private mem = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly durable: DurableStore | null;
  private readonly now: () => number;
  private readonly maxEntries: number;
  constructor(durable: DurableStore | null = null, now: () => number = Date.now, maxEntries = 500) {
    this.durable = durable;
    this.now = now;
    this.maxEntries = maxEntries;
  }

  async get<T>(key: string): Promise<T | null> {
    const hit = this.mem.get(key);
    if (hit) {
      if (hit.expiresAt > this.now()) return hit.value as T;
      this.mem.delete(key);
    }
    if (!this.durable) return null;
    try {
      const v = await this.durable.get(key);
      if (v != null) this.mem.set(key, { value: v, expiresAt: this.now() + 60_000 });
      return (v as T) ?? null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (this.mem.size >= this.maxEntries) {
      const first = this.mem.keys().next().value;
      if (first !== undefined) this.mem.delete(first);
    }
    this.mem.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
    if (!this.durable) return;
    try {
      await this.durable.set(key, value, ttlSeconds);
    } catch {
      /* a cache write failure must never fail the request */
    }
  }

  /** Get, or compute and store. */
  async wrap<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<{ value: T; cached: boolean }> {
    const hit = await this.get<T>(key);
    if (hit != null) return { value: hit, cached: true };
    const value = await compute();
    await this.set(key, value, ttlSeconds);
    return { value, cached: false };
  }
}

export function searchCacheKey(p: { q: string; country: string; city: string; type: string; limit: number }, provider: string) {
  return ['search', provider, p.country.toUpperCase(), p.city.trim().toLowerCase(), p.type, p.q.trim().toLowerCase(), p.limit].join('|');
}

/**
 * Fixed-window per-user rate limit. Uses KV when bound; otherwise an
 * in-memory window per isolate (not global, but stops a runaway client).
 */
export class RateLimiter {
  private mem = new Map<string, number>();
  private readonly limitPerMinute: number;
  private readonly kv: KVNamespaceLike | null;
  private readonly now: () => number;
  constructor(limitPerMinute: number, kv: KVNamespaceLike | null = null, now: () => number = Date.now) {
    this.limitPerMinute = limitPerMinute;
    this.kv = kv;
    this.now = now;
  }

  async allow(subject: string): Promise<boolean> {
    const windowId = Math.floor(this.now() / 60_000);
    const key = `bc-rl:${subject}:${windowId}`;
    if (this.kv) {
      const current = parseInt((await this.kv.get(key)) ?? '0', 10);
      if (current >= this.limitPerMinute) return false;
      await this.kv.put(key, String(current + 1), { expirationTtl: 90 });
      return true;
    }
    const current = this.mem.get(key) ?? 0;
    if (current >= this.limitPerMinute) return false;
    this.mem.set(key, current + 1);
    if (this.mem.size > 2000) this.mem.clear();
    return true;
  }
}

export interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
