import { createClient } from '@supabase/supabase-js';
import type { Env } from './types';
import { apiError, json } from './types';
import { hashApiKey, looksLikeApiKey } from './apiKeyCrypto';
import { CreatorDataNotConnectedError, CreatorSearchUnavailableError, searchCreators } from './creatorSearchService';
import { hasCreatorApiAccess } from './creatorApiSubscription';

const SCOPE = 'search_creator_api';
const RATE_LIMIT_PER_MINUTE = 60;
const MAX_QUERY_LENGTH = 100;
const REGION_PATTERN = /^[A-Z]{2}$/;

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
 * Fixed-window rate limit, ~60 requests/minute per key. Uses a KV namespace
 * (`API_RATE_LIMIT`) if the environment has one bound; otherwise fails open
 * rather than blocking real traffic on missing infrastructure — see the
 * worker README for the binding to add.
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
 * GET /api/v1/creators/search?q=...&region=...
 *
 * The public, paid Creator Search API. Bearer-authenticated, not tied to any
 * browser session. Calls the same `searchCreators` gateway an in-app search
 * would — see creatorSearchService.ts for why it currently returns an
 * honest "not connected" error rather than fabricated results.
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
  const q = (url.searchParams.get('q') || '').trim();
  const region = (url.searchParams.get('region') || '').trim().toUpperCase();

  if (!q || q.length > MAX_QUERY_LENGTH) {
    const res = apiError('INVALID_REQUEST', 'q is required and must be 1–100 characters.', 400);
    await logUsage(env, key, 400);
    return res;
  }
  if (region && !REGION_PATTERN.test(region)) {
    const res = apiError('INVALID_REQUEST', 'region must be a 2-letter market code, e.g. GB.', 400);
    await logUsage(env, key, 400);
    return res;
  }

  try {
    const creators = await searchCreators(env, { q, region: region || undefined });
    await logUsage(env, key, 200);
    return json({ success: true, data: { creators } });
  } catch (err) {
    if (err instanceof CreatorDataNotConnectedError) {
      const res = apiError('CREATOR_DATA_NOT_CONNECTED', 'Creator data source is not connected.', 503);
      await logUsage(env, key, 503);
      return res;
    }
    if (err instanceof CreatorSearchUnavailableError) {
      const res = apiError('SERVICE_UNAVAILABLE', 'Creator search is temporarily unavailable.', 503);
      await logUsage(env, key, 503);
      return res;
    }
    const res = apiError('INTERNAL_ERROR', 'Something went wrong handling this request.', 500);
    await logUsage(env, key, 500);
    return res;
  }
}
