import { createClient } from '@supabase/supabase-js';
import type { Env } from '../types';
import { getAuthenticatedUserId } from '../auth';
import { searchCreators, CreatorSearchNotFoundError } from '../creatorSearchService';
import { handleBusinessRequest, type BusinessApiDeps } from './businessApi.ts';
import { BusinessCache, RateLimiter, type DurableStore } from './businessCache.ts';
import { getBusinessProvider, providerForId } from './businessDataProvider.ts';
import { SupabaseBusinessStore } from './businessStore.ts';
import { inspectProfilePage, inspectWebsite } from './websiteInspector.ts';
import { fetchWithTimeout } from './httpUtil.ts';

export { isBusinessRoute } from './businessApi.ts';

/** Production wiring for Business Connect. Module-level so the in-memory cache survives across requests in an isolate. */
let memoCache: BusinessCache | null = null;
let memoLimiter: RateLimiter | null = null;

function supabaseDurable(env: Env): DurableStore {
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  return {
    async get(key) {
      const { data } = await db
        .from('business_cache')
        .select('response, expires_at')
        .eq('cache_key', key)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      return data?.response ?? null;
    },
    async set(key, value, ttl) {
      await db.from('business_cache').upsert(
        { cache_key: key, response: value, expires_at: new Date(Date.now() + ttl * 1000).toISOString() },
        { onConflict: 'cache_key' }
      );
    },
  };
}

export async function handleBusinessConnect(request: Request, env: Env): Promise<Response> {
  const hasDb = !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  memoCache ??= new BusinessCache(hasDb ? supabaseDurable(env) : null);
  memoLimiter ??= new RateLimiter(40, env.API_RATE_LIMIT ?? null);
  const frontend = env.FRONTEND_URL || 'https://launchly.pazeruga.workers.dev';

  const deps: BusinessApiDeps = {
    getUserId: (req) => getAuthenticatedUserId(req, env),
    searchProvider: () => getBusinessProvider(env),
    providerForId: (id) => providerForId(id, env),
    cache: memoCache,
    limiter: memoLimiter,
    store: hasDb ? new SupabaseBusinessStore(createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)) : null,
    inspectWebsite: (url) => inspectWebsite(url, frontend),
    inspectProfilePage: (url) => inspectProfilePage(url, frontend),
    async lookupTikTok(username) {
      // Same public-profile collector the Search Creator API uses.
      try {
        const r = await searchCreators(env, { q: username });
        const c: any = r.creator;
        return {
          username: c.username ?? username,
          displayName: c.displayName ?? null,
          avatar: c.avatar ?? null,
          bio: c.bio ?? null,
          followers: c.followers ?? null,
          following: c.following ?? null,
          likes: c.likes ?? null,
          videos: (r.recentVideos ?? []).slice(0, 9).map((v: any) => ({
            id: v.id ?? null,
            cover: v.cover ?? null,
            description: v.description ?? null,
            views: v.views ?? null,
          })),
        };
      } catch (err) {
        if (err instanceof CreatorSearchNotFoundError) return null;
        throw err;
      }
    },
    fetchPhoto: env.GOOGLE_PLACES_API_KEY
      ? async (name) => {
          const res = await fetchWithTimeout(
            `https://places.googleapis.com/v1/${name}/media?maxWidthPx=480&key=${env.GOOGLE_PLACES_API_KEY}`,
            {},
            8000
          );
          return new Response(res.body, {
            status: res.status,
            headers: {
              'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
              'Cache-Control': 'public, max-age=86400',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      : undefined,
    emailStatus: () => ({ configured: !!(env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET), provider: 'gmail' }),
  };
  return handleBusinessRequest(request, deps);
}
