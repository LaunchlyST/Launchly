import { createClient } from '@supabase/supabase-js';
import type { Env } from './types';
import { apiError, json } from './types';
import { getAuthenticatedUserId } from './auth';
import { generateApiKey, hashApiKey, keyPrefix } from './apiKeyCrypto';
import { hasCreatorApiAccess } from './creatorApiSubscription';

const SCOPE = 'search_creator_api';

function getSupabase(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * POST /api/developer/api-keys
 *
 * Creates a new Launchly API key. The full secret is returned exactly once,
 * in this response — only its hash and a short prefix are stored.
 */
export async function handleCreateApiKey(request: Request, env: Env): Promise<Response> {
  const userId = await getAuthenticatedUserId(request, env);
  if (!userId) return apiError('UNAUTHENTICATED', 'Sign in required.', 401);

  if (!(await hasCreatorApiAccess(env, userId))) {
    return apiError(
      'API_SUBSCRIPTION_REQUIRED',
      'An active Search Creator API subscription is required.',
      403
    );
  }

  let name = 'Default API Key';
  try {
    const body = await request.json<{ name?: string }>();
    if (body?.name && typeof body.name === 'string' && body.name.trim()) {
      name = body.name.trim().slice(0, 80);
    }
  } catch {
    /* no body — use the default name */
  }

  const fullKey = generateApiKey();
  const hash = await hashApiKey(fullKey);
  const prefix = keyPrefix(fullKey);

  const supabase = getSupabase(env);
  const { data, error } = await supabase
    .from('api_keys')
    .insert({ user_id: userId, name, key_prefix: prefix, key_hash: hash, scope: SCOPE })
    .select('id, name, key_prefix, scope, status, created_at, last_used_at')
    .single();

  if (error || !data) {
    return apiError('KEY_CREATE_FAILED', 'Could not create the API key.', 500);
  }

  return json({
    success: true,
    data: {
      id: data.id,
      name: data.name,
      keyPrefix: data.key_prefix,
      scope: data.scope,
      status: data.status,
      createdAt: data.created_at,
      lastUsedAt: data.last_used_at,
      /* Only present in this one response. */
      apiKey: fullKey,
    },
  });
}

/** GET /api/developer/api-keys — metadata only, never the hash or full key. */
export async function handleListApiKeys(request: Request, env: Env): Promise<Response> {
  const userId = await getAuthenticatedUserId(request, env);
  if (!userId) return apiError('UNAUTHENTICATED', 'Sign in required.', 401);

  const supabase = getSupabase(env);
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, scope, status, created_at, last_used_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return apiError('KEY_LIST_FAILED', 'Could not load API keys.', 500);

  return json({
    success: true,
    data: (data ?? []).map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.key_prefix,
      scope: k.scope,
      status: k.status,
      createdAt: k.created_at,
      lastUsedAt: k.last_used_at,
    })),
  });
}

/**
 * GET /api/developer/api-usage
 *
 * Lightweight, real usage counts from api_usage_events for the Developer
 * page's Quick Start card. Returns only what can be computed for real.
 */
export async function handleApiUsage(request: Request, env: Env): Promise<Response> {
  const userId = await getAuthenticatedUserId(request, env);
  if (!userId) return apiError('UNAUTHENTICATED', 'Sign in required.', 401);

  const supabase = getSupabase(env);
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const [today, month, last] = await Promise.all([
    supabase
      .from('api_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfDay),
    supabase
      .from('api_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth),
    supabase
      .from('api_usage_events')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return json({
    success: true,
    data: {
      requestsToday: today.count ?? 0,
      requestsThisMonth: month.count ?? 0,
      lastRequestAt: last.data?.created_at ?? null,
    },
  });
}

/** POST /api/developer/api-keys/:id/revoke */
export async function handleRevokeApiKey(request: Request, env: Env, keyId: string): Promise<Response> {
  const userId = await getAuthenticatedUserId(request, env);
  if (!userId) return apiError('UNAUTHENTICATED', 'Sign in required.', 401);

  const supabase = getSupabase(env);
  const { data: existing } = await supabase
    .from('api_keys')
    .select('id, user_id')
    .eq('id', keyId)
    .maybeSingle();

  if (!existing || existing.user_id !== userId) {
    return apiError('NOT_FOUND', 'API key not found.', 404);
  }

  const { error } = await supabase
    .from('api_keys')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', keyId);

  if (error) return apiError('KEY_REVOKE_FAILED', 'Could not revoke the API key.', 500);

  return json({ success: true, data: { id: keyId, status: 'revoked' } });
}
