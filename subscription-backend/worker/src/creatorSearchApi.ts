import { createClient } from '@supabase/supabase-js';
import type { Env } from './types';
import { apiError, json } from './types';
import { hashApiKey, looksLikeApiKey } from './apiKeyCrypto';
import {
  CreatorSearchInvalidQueryError,
  CreatorSearchNotFoundError,
  CreatorSearchUnavailableError,
  searchCreators,
} from './creatorSearchService';
import { hasCreatorApiAccess } from './creatorApiSubscription';

const SCOPE = 'search_creator_api';
const RATE_LIMIT_PER_MINUTE = 60;

function getSupabase(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

interface AuthorizedKey {
  keyId: string;
  userId: string;
}

/**
 * Authenticate an external request via `Authorization: Bearer lch_live_...`.
 * Returns the matched key/user, or a Response to send back immediately.
 * Nothing downstream (rate limit, creator search) runs until this passes —
 * TikTok is never contacted before authorization succeeds.
 */
async function authorizeRequest(
  request: Request,
  env: Env
): Promise<{ ok: true; key: AuthorizedKey } | { ok: false; response: Response }> {
  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token || !looksLikeApiKey(token)) {
    return { ok: false, response: apiError('INVALID_API_KEY', 'Invalid API key.', 401) };
  }

  const hash = await hashApiKey(token);
  const supabase = getSupabase(env);

  const { data: keyRow } = await supabase
    .from('api_keys')
    .select('id, user_id, status, scope')
    .eq('key_hash', hash)
    .maybeSingle();

  if (!keyRow || keyRow.status !== 'active') {
    return { ok: false, response: apiError('INVALID_API_KEY', 'Invalid API key.', 401) };
  }

  if (keyRow.scope !== SCOPE) {
    return { ok: false, response: apiError('INVALID_API_KEY', 'Invalid API key.', 401) };
  }

  if (!(await hasCreatorApiAccess(env, keyRow.user_id))) {
    return {
      ok: false,
      response: apiError(
        'API_SUBSCRIPTION_REQUIRED',
        'An active Search Creator API subscription is required.',
        403
      ),
    };
  }

  // Best-effort, non-blocking.
  supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRow.id);

  return { ok: true, key: { keyId: keyRow.id, userId: keyRow.user_id } };
}

/**
 * Fixed-window rate limit, 60 requests/minute per key. Uses a KV namespace
 * (`API_RATE_LIMIT`) if the environment has one bound; otherwise this fails
 * open (no limit enforced) rather than blocking real traffic on missing
 * infrastructure. This is a per-colo fixed window, not a globally exact
 * distributed limiter — enough to stop obvious abuse, not a billing meter.
 */
async function checkRateLimit(env: Env, keyId: string): Promise<boolean> {
  if (!env.API_RATE_LIMIT) return true;
  const windowId = Math.floor(Date.now() / 60_000);
  const bucketKey = `rl:${keyId}:${windowId}`;

  const current = parseInt((await env.API_RATE_LIMIT.get(bucketKey)) ?? '0', 10);
  if (current >= RATE_LIMIT_PER_MINUTE) return false;

  await env.API_RATE_LIMIT.put(bucketKey, String(current + 1), { expirationTtl: 90 });
  return true;
}

async function logUsage(env: Env, key: AuthorizedKey, status: number) {
  try {
    const supabase = getSupabase(env);
    await supabase.from('api_usage_events').insert({
      api_key_id: key.keyId,
      user_id: key.userId,
      endpoint: '/api/v1/creators/search',
      status_code: status,
    });
  } catch {
    /* usage logging must never break the actual API response */
  }
}

/**
 * GET /api/v1/creators/search?q=...
 *
 * The public, paid Creator Search API. Bearer-authenticated, not tied to any
 * browser session. Calls the same `searchCreators` gateway an in-app search
 * uses — see creatorSearchService.ts for the real collection pipeline.
 * Security order is fixed: API key → scope → subscription → rate limit →
 * search. A request that fails any earlier step never reaches TikTok.
 */
export async function handleCreatorSearchApi(request: Request, env: Env): Promise<Response> {
  const authResult = await authorizeRequest(request, env);
  if (!authResult.ok) return authResult.response;
  const { key } = authResult;

  const allowed = await checkRateLimit(env, key.keyId);
  if (!allowed) {
    const res = apiError('RATE_LIMITED', 'Too many requests. Please try again shortly.', 429);
    await logUsage(env, key, 429);
    return res;
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';

  try {
    const result = await searchCreators(env, { q });
    await logUsage(env, key, 200);
    return json({
      success: true,
      ...(result.stale ? { stale: true } : {}),
      data: { creator: result.creator, recentVideos: result.recentVideos },
    });
  } catch (err) {
    if (err instanceof CreatorSearchInvalidQueryError) {
      await logUsage(env, key, 400);
      return apiError('INVALID_QUERY', 'Invalid creator username.', 400);
    }
    if (err instanceof CreatorSearchNotFoundError) {
      await logUsage(env, key, 404);
      return apiError('CREATOR_NOT_FOUND', 'Creator not found.', 404);
    }
    if (err instanceof CreatorSearchUnavailableError) {
      await logUsage(env, key, 503);
      return apiError('CREATOR_DATA_UNAVAILABLE', 'Creator data is temporarily unavailable.', 503);
    }
    console.error('[creator-search-api] unexpected error', err instanceof Error ? err.message : err);
    await logUsage(env, key, 500);
    return apiError('SERVER_ERROR', 'Something went wrong handling this request.', 500);
  }
}
