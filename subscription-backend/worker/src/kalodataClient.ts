import type { Env } from './types';

/**
 * Server-side client for the real upstream creator-data provider (Kalodata).
 *
 * `KALODATA_API_KEY` never leaves this file — it is read from `env`, sent
 * upstream, and never logged, echoed back, or exposed to the frontend.
 *
 * NOTE: the exact endpoint path/query shape below is Launchly's best-effort
 * mapping onto Kalodata's documented creator-search API. Nobody on this task
 * had live access to Kalodata's docs to verify the request/response shape
 * byte-for-byte — verify `KALODATA_SEARCH_PATH` and the field names in
 * `normalizeCreator` against the real docs before relying on this in
 * production, and adjust just this one file if they differ.
 */

const KALODATA_SEARCH_PATH = '/api/v1/creators/search';
const REQUEST_TIMEOUT_MS = 8000;

export class UpstreamConfigError extends Error {}
export class UpstreamRequestError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

interface KalodataCreatorRaw {
  id?: string | number;
  username?: string;
  handle?: string;
  display_name?: string;
  nickname?: string;
  avatar?: string;
  avatar_url?: string;
  region?: string;
  country?: string;
  followers?: number;
  follower_count?: number;
  likes?: number;
  like_count?: number;
  video_count?: number;
  videos?: number;
  gmv?: number;
  gmv_30d?: number;
  items_sold?: number;
  sales_count?: number;
  product_count?: number;
  products?: number;
}

export interface NormalizedCreator {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  region: string | null;
  followers: number | null;
  likes: number | null;
  videoCount: number | null;
  gmv: number | null;
  itemsSold: number | null;
  productCount: number | null;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function normalizeCreator(raw: KalodataCreatorRaw): NormalizedCreator {
  return {
    id: String(raw.id ?? raw.username ?? raw.handle ?? crypto.randomUUID()),
    username: str(raw.username ?? raw.handle) ?? '',
    displayName: str(raw.display_name ?? raw.nickname),
    avatar: str(raw.avatar ?? raw.avatar_url),
    region: str(raw.region ?? raw.country),
    followers: num(raw.followers ?? raw.follower_count),
    likes: num(raw.likes ?? raw.like_count),
    videoCount: num(raw.video_count ?? raw.videos),
    gmv: num(raw.gmv ?? raw.gmv_30d),
    itemsSold: num(raw.items_sold ?? raw.sales_count),
    productCount: num(raw.product_count ?? raw.products),
  };
}

/**
 * Search creators by username through the real upstream provider. Throws
 * `UpstreamConfigError` if the worker isn't configured with a key, and
 * `UpstreamRequestError` for any non-2xx or network/timeout failure — both
 * are safe, generic errors: neither ever carries the upstream key, upstream
 * headers, or the upstream's own error body back to the caller.
 */
export async function kalodataSearchCreators(
  env: Env,
  params: { q: string; region?: string }
): Promise<NormalizedCreator[]> {
  if (!env.KALODATA_API_KEY) {
    throw new UpstreamConfigError('KALODATA_API_KEY is not configured.');
  }

  const baseUrl = (env.KALODATA_API_BASE_URL || 'https://api.kalodata.com').replace(/\/+$/, '');
  const url = new URL(`${baseUrl}${KALODATA_SEARCH_PATH}`);
  url.searchParams.set('q', params.q);
  if (params.region) url.searchParams.set('region', params.region);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${env.KALODATA_API_KEY}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (err) {
    throw new UpstreamRequestError(
      err instanceof Error && err.name === 'AbortError' ? 'Upstream request timed out.' : 'Upstream request failed.'
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    // Never forward the upstream's own error body — it may contain
    // provider-identifying details this API must not expose to customers.
    throw new UpstreamRequestError('Upstream provider returned an error.', res.status);
  }

  let body: { creators?: KalodataCreatorRaw[]; results?: KalodataCreatorRaw[] };
  try {
    body = await res.json();
  } catch {
    throw new UpstreamRequestError('Upstream provider returned an unreadable response.');
  }

  const rows = body.creators ?? body.results ?? [];
  return rows.map(normalizeCreator);
}
