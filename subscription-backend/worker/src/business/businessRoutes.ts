import { createClient } from '@supabase/supabase-js';
import { CreatorNotFoundError, collectTikTokProfile } from './tiktokPublicCollector.ts';
import { handleBusinessRequest, type BusinessApiDeps } from './businessApi.ts';
import { BusinessCache, RateLimiter, type DurableStore } from './businessCache.ts';
import { getBusinessProvider, providerForId } from './businessDataProvider.ts';
import { SupabaseBusinessStore } from './businessStore.ts';
import { inspectProfilePage, inspectWebsite } from './websiteInspector.ts';
import { fetchWithTimeout } from './httpUtil.ts';

export { isBusinessRoute } from './businessApi.ts';

export interface BusinessEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  FRONTEND_URL: string;
  GOOGLE_PLACES_API_KEY?: string;
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
  API_RATE_LIMIT?: KVNamespace;
}
type Env = BusinessEnv;

/** Verify the caller from their Supabase access token — never a client-sent userId. */
async function getAuthenticatedUserId(request: Request, env: Env): Promise<string | null> {
  const token = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data, error } = await createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY).auth.getUser(token);
  return error || !data?.user ? null : data.user.id;
}

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
      // Reads the public TikTok profile page, as any signed-out visitor would.
      try {
        const p = await collectTikTokProfile(username);
        return {
          username: p.username,
          displayName: p.displayName,
          avatar: p.avatar,
          bio: p.bio,
          followers: p.followers,
          following: p.following,
          likes: p.likes,
          videos: p.videos.slice(0, 9).map((v) => ({ id: v.id, cover: v.cover, description: v.description, views: v.views })),
        };
      } catch (err) {
        if (err instanceof CreatorNotFoundError) return null;
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
