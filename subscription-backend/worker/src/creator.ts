import { createClient } from '@supabase/supabase-js';
import type { Env } from './index';
import { LAUNCHLY_CREATOR_SERVICE, creatorMarkets, normalizeCreatorQuery, validCreatorQuery, type CreatorErrorCode, type CreatorRegion } from '../../../shared/creator-contract';
import { CreatorServiceError, creatorProviderRequest, hasCreatorProviderKey, normalizeCreator, normalizeProduct, normalizeProfile, normalizeVideo, rows, record } from './services/creator-provider';
import { hasLaunchlyCreatorPlan } from './services/creator-plan';

const messages: Record<CreatorErrorCode, string> = {
  INVALID_QUERY: 'Enter a creator username and a supported market and period.',
  CREATOR_NOT_FOUND: 'Creator not found.', UNAUTHORIZED: 'Sign in to search creators.',
  SUBSCRIPTION_REQUIRED: 'An active £5/month Launchly Creator API subscription is required.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  UPSTREAM_ERROR: 'Unable to load creator data. Please try again.',
  SERVER_ERROR: 'Unable to load creator data. Please try again.',
};
export function creatorError(code: CreatorErrorCode, status: number, headers: Record<string, string>) {
  return reply({ success: false, error: { code, message: messages[code] } }, status, headers);
}
function reply(data: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify({ ...data, service: LAUNCHLY_CREATOR_SERVICE }), { status, headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '5' } : {}) } });
}
function integer(value: string | null, fallback: number, min: number, max: number) {
  if (value === null) return fallback;
  return /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max ? Number(value) : NaN;
}
export function parseCreatorRequest(url: URL) {
  const path = url.pathname.match(/^\/api\/launchly\/creators\/(search|status|\d{1,30})(?:\/(products|videos))?$/);
  if (!path || (path[2] && ['search', 'status'].includes(path[1]))) return null;
  const endpoint = path[2] || path[1];
  const region = (url.searchParams.get('region') || 'GB').toUpperCase() as CreatorRegion;
  const page = integer(url.searchParams.get('page'), 1, 1, 5);
  const pageSize = integer(url.searchParams.get('pageSize'), 20, 5, 100);
  const period = integer(url.searchParams.get('period'), 30, 7, 365);
  const detail = /^\d+$/.test(endpoint);
  const rawQuery = url.searchParams.get('q') || '';
  const query = endpoint === 'search' ? normalizeCreatorQuery(rawQuery) : '';
  if (!Object.hasOwn(creatorMarkets, region) || !Number.isFinite(page) || !Number.isFinite(pageSize) ||
      !(detail || endpoint === 'search' ? [7, 30, 90, 180, 365] : [7, 30]).includes(period) ||
      (endpoint === 'search' && (rawQuery.length > 512 || !validCreatorQuery(rawQuery)))) return null;
  const currency = creatorMarkets[region].currency;
  const id = detail || path[2] ? path[1] : null;
  const kind = detail ? 'detail' : endpoint;
  const cacheKey = JSON.stringify(['launchly-creator-v2', kind, region, currency, period, query, id, detail ? 1 : page, detail ? 20 : pageSize]);
  return { kind, region, currency, page, pageSize, period, query, id, cacheKey };
}

export async function handleCreator(request: Request, env: Env, headers: Record<string, string>): Promise<Response> {
  let release: (() => Promise<void>) | undefined;
  try {
    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return creatorError('UNAUTHORIZED', 401, headers);
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.STRIPE_PRICE_ID) return creatorError('SERVER_ERROR', 503, headers);
    const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return creatorError('UNAUTHORIZED', 401, headers);
    const { data: subscription, error: subscriptionError } = await db.from('users')
      .select('subscription_status, subscription_current_period_end, subscription_price_id, creator_api_plan_verified').eq('id', auth.user.id).maybeSingle();
    if (subscriptionError) return creatorError('SERVER_ERROR', 503, headers);
    if (!hasLaunchlyCreatorPlan(subscription, env.STRIPE_PRICE_ID)) return creatorError('SUBSCRIPTION_REQUIRED', 403, headers);
    const parsed = parseCreatorRequest(new URL(request.url));
    if (!parsed || request.method !== 'GET') return creatorError('INVALID_QUERY', 400, headers);
    const { kind, region, currency, page, pageSize, period, query, id, cacheKey } = parsed;
    if (kind === 'status') {
      const { error } = await db.from('creator_api_cache').select('id').limit(1);
      if (error || !hasCreatorProviderKey(env)) return reply({ success: false, status: 'offline', error: { code: 'SERVER_ERROR', message: messages.SERVER_ERROR } }, 503, headers);
      return reply({ success: true, status: 'online' }, 200, headers);
    }
    // A database transaction enforces limits across Worker instances and regions.
    const { data: lease, error: leaseError } = await db.rpc('acquire_creator_request', { p_user_id: auth.user.id, p_cache_key: cacheKey });
    if (leaseError) return creatorError('SERVER_ERROR', 503, headers);
    if (!lease) return creatorError('RATE_LIMITED', 429, headers);
    release = async () => { await db.from('creator_request_leases').update({ released: true }).eq('id', lease).eq('user_id', auth.user.id); };
    const { data: cached, error: cacheError } = await db.from('creator_api_cache').select('response, expires_at')
      .eq('cache_key', cacheKey).maybeSingle();
    // Fail closed if the migration/cache is unavailable, avoiding uncontrolled paid calls.
    if (cacheError) return creatorError('SERVER_ERROR', 503, headers);
    const expires = cached ? Date.parse(cached.expires_at) : 0;
    if (cached && expires > Date.now()) {
      if (env.CREATOR_DEBUG === 'true') console.log('Creator request', { endpoint: kind, region, cache: 'hit' });
      return reply({ success: true, data: cached.response }, 200, headers);
    }
    const body = { region, currency, language: 'en-US', date_range: `last${period}Day` };
    const ranking = { ...body, page_number: page, page_size: pageSize, sort_field: { field: 'revenue', type: 'DESC' } };
    let data: unknown;
    try {
      if (kind === 'search') {
        if (period > 30) {
          // Ranking is capped at 30 days; the documented handle-detail API supports a year.
          // Never relabel 30-day rankings as a longer period or sum overlapping windows.
          const raw = page === 1 ? await creatorProviderRequest('/tiktok/creator/detailByHandle', { ...body, creator_handle: query, need_extra: true }, env) : null;
          if (raw !== null && !record(raw)) throw new CreatorServiceError('UPSTREAM_ERROR', 502, true);
          const creator = raw === null ? null : normalizeCreator(raw, region, currency);
          // Handle lookup is fuzzy upstream: only return the requested handle.
          const creators = creator && creator.username.toLowerCase() === query ? [creator] : [];
          data = { creators, pagination: { page, pageSize, hasMore: false } };
        } else {
          const creators = rows(await creatorProviderRequest('/tiktok/creator/rank', { ...ranking, keyword: query }, env))
            .map(row => normalizeCreator(row, region, currency));
          data = { creators, pagination: { page, pageSize, hasMore: page < 5 && creators.length === pageSize } };
        }
      } else if (kind === 'detail') {
        data = normalizeProfile(await creatorProviderRequest('/tiktok/creator/detail', { ...body, creator_id: id, need_extra: true }, env), id!, region, currency);
      } else if (kind === 'products') {
        const products = rows(await creatorProviderRequest('/tiktok/product/rank', { ...ranking, creator_id: id }, env)).map(normalizeProduct);
        data = { products, pagination: { page, pageSize, hasMore: page < 5 && products.length === pageSize } };
      } else {
        const videos = rows(await creatorProviderRequest('/tiktok/video/rank', { ...ranking, creator_id: id, need_extra: true }, env)).map(normalizeVideo);
        data = { videos, pagination: { page, pageSize, hasMore: page < 5 && videos.length === pageSize } };
      }
    } catch (error) {
      // Only temporary upstream failures may use data expired less than 24 hours ago.
      if (error instanceof CreatorServiceError && error.transient && cached && expires > Date.now() - 86400000) {
        return reply({ success: true, data: cached.response, stale: true }, 200, headers);
      }
      throw error;
    }
    const ttl = ['search', 'detail'].includes(kind) ? 6 : 3;
    const { error: writeError } = await db.from('creator_api_cache').upsert({ cache_key: cacheKey, creator_id: id, query: query || null,
      region, endpoint: kind, response: data, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + ttl * 3600000).toISOString() }, { onConflict: 'cache_key' });
    if (writeError) console.error('Creator cache write failed');
    if (env.CREATOR_DEBUG === 'true') console.log('Creator request', { endpoint: kind, region, cache: 'miss' });
    return reply({ success: true, data }, 200, headers);
  } catch (error) {
    return error instanceof CreatorServiceError ? creatorError(error.code, error.status, headers) : creatorError('SERVER_ERROR', 500, headers);
  } finally {
    try { await release?.(); } catch { /* Leases expire after 30 seconds if cleanup fails. */ }
  }
}
