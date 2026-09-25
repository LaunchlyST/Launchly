/**
 * The actual creator-search data layer: cache-in-front-of-upstream, shared
 * by both the public GET /api/v1/creators/search and any future in-app
 * search. Callers should never talk to kalodataClient.ts directly — this is
 * the one place that decides cache vs. live upstream call.
 */
import { createClient } from '@supabase/supabase-js';
import type { Env } from './types';
import {
  kalodataSearchCreators,
  UpstreamConfigError,
  UpstreamRequestError,
  type NormalizedCreator,
} from './kalodataClient';

export interface CreatorSearchParams {
  q: string;
  region?: string;
}

export type CreatorResult = NormalizedCreator;

export class CreatorSearchUnavailableError extends Error {}
/** Specifically: no upstream provider is wired in yet (KALODATA_API_KEY unset). */
export class CreatorDataNotConnectedError extends Error {}

const SEARCH_CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 hours

function getSupabase(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

function cacheKey(params: CreatorSearchParams): string {
  const region = (params.region || 'ALL').toUpperCase();
  const q = params.q.trim().toLowerCase();
  return `creator:search:${region}:${q}`;
}

async function readCache(env: Env, key: string): Promise<CreatorResult[] | null> {
  try {
    const supabase = getSupabase(env);
    const { data } = await supabase
      .from('creator_api_cache')
      .select('response, expires_at')
      .eq('cache_key', key)
      .maybeSingle();

    if (!data) return null;
    if (new Date(data.expires_at).getTime() <= Date.now()) return null;
    return data.response as CreatorResult[];
  } catch {
    return null; // cache is an optimization, never a hard dependency
  }
}

async function writeCache(env: Env, key: string, params: CreatorSearchParams, results: CreatorResult[]) {
  try {
    const supabase = getSupabase(env);
    const expiresAt = new Date(Date.now() + SEARCH_CACHE_TTL_SECONDS * 1000).toISOString();
    await supabase.from('creator_api_cache').upsert(
      {
        cache_key: key,
        query: params.q,
        region: params.region ?? null,
        endpoint: 'search',
        response: results,
        expires_at: expiresAt,
      },
      { onConflict: 'cache_key' }
    );
  } catch {
    /* a failed cache write must never fail the actual search response */
  }
}

/**
 * Search creators, using the cache in front of the real Kalodata upstream.
 * Never returns fabricated data: a config or upstream failure raises
 * CreatorSearchUnavailableError instead of falling back to placeholder rows.
 */
export async function searchCreators(env: Env, params: CreatorSearchParams): Promise<CreatorResult[]> {
  const key = cacheKey(params);

  const cached = await readCache(env, key);
  if (cached) return cached;

  try {
    const results = await kalodataSearchCreators(env, params);
    await writeCache(env, key, params, results);
    return results;
  } catch (err) {
    if (err instanceof UpstreamConfigError) {
      throw new CreatorDataNotConnectedError('Creator data source is not connected.');
    }
    if (err instanceof UpstreamRequestError) {
      throw new CreatorSearchUnavailableError('Creator search is temporarily unavailable.');
    }
    throw new CreatorSearchUnavailableError('Creator search is temporarily unavailable.');
  }
}
