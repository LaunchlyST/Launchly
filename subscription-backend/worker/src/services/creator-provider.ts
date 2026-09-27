// Reference: provider-linked github.com/sailtonight/kalodata-skill, commands/creator.py,
// commands/{common,product,video}.py, api.py and config.py; checked 2026-09-24.
import type { CreatorProduct, CreatorProfile, CreatorRegion, CreatorSearchResult, CreatorVideo } from '../../../../shared/creator-contract';
export class CreatorServiceError extends Error {
  constructor(public code: 'UPSTREAM_ERROR' | 'SERVER_ERROR' | 'CREATOR_NOT_FOUND', public status = 502, public transient = false) {
    super(code);
  }
}
type Endpoint = '/tiktok/creator/rank' | '/tiktok/creator/detail' | '/tiktok/creator/detailByHandle' | '/tiktok/product/rank' | '/tiktok/video/rank';
export type RawRow = Record<string, unknown>;
export const record = (value: unknown): value is RawRow => !!value && typeof value === 'object' && !Array.isArray(value);
export interface CreatorProviderEnv { CREATOR_DATA_API_KEY?: string; KALODATA_API_KEY?: string; CREATOR_DEBUG?: string }
export const hasCreatorProviderKey = (env: CreatorProviderEnv) => !!(env.CREATOR_DATA_API_KEY || env.KALODATA_API_KEY);
export async function creatorProviderRequest(endpoint: Endpoint, body: RawRow, env: CreatorProviderEnv): Promise<unknown> {
  const key = env.CREATOR_DATA_API_KEY || env.KALODATA_API_KEY; // Legacy secret stays confined to this adapter.
  if (!key) {
    // Server logs only. No provider names or configuration details reach the browser.
    console.error('Launchly Creator API: CREATOR_DATA_API_KEY is not configured.');
    throw new CreatorServiceError('SERVER_ERROR', 503);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const started = Date.now();
  try {
    const response = await fetch(`https://www.kalodata.com/openapi/v1${endpoint}`, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'secret-key': key, 'Content-Type': 'application/json;charset=UTF-8' },
      body: JSON.stringify(body),
    });
    if (env.CREATOR_DEBUG === 'true') console.log('Creator upstream request', { endpoint, status: response.status, durationMs: Date.now() - started });
    if (!response.ok) throw new CreatorServiceError('UPSTREAM_ERROR', 502, response.status >= 500 || response.status === 429);
    const envelope: unknown = await response.json();
    if (!record(envelope)) throw new CreatorServiceError('UPSTREAM_ERROR', 502, true);
    if (envelope.success !== true) {
      // The provider's current client documents a definitive not-found message.
      if (typeof envelope.message === 'string' && /not found|未找到/i.test(envelope.message)) return null;
      throw new CreatorServiceError('UPSTREAM_ERROR', 502, String(envelope.code) === '2000');
    }
    return envelope.data;
  } catch (error) {
    if (error instanceof CreatorServiceError) throw error;
    throw new CreatorServiceError('UPSTREAM_ERROR', 502, true);
  } finally { clearTimeout(timeout); }
}
export function rows(value: unknown): RawRow[] {
  if (value === null) return [];
  const list = Array.isArray(value) ? value : record(value) && Array.isArray(value.data) ? value.data : null;
  if (!list || !list.every(record)) throw new CreatorServiceError('UPSTREAM_ERROR', 502, true);
  return list;
}
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
export const numeric = (value: unknown): number | null => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const number = Number(value); return Number.isFinite(number) ? number : null;
};
function identifier(value: unknown): string {
  if (typeof value === 'string' && /^\d{1,30}$/.test(value)) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  throw new CreatorServiceError('UPSTREAM_ERROR', 502, true);
}
export function normalizeCreator(row: RawRow, region: CreatorRegion, currency: string): CreatorSearchResult {
  const username = text(row.creator_handle)?.replace(/^@/, '');
  if (!username || (row.creator_region != null && row.creator_region !== region)) throw new CreatorServiceError('UPSTREAM_ERROR');
  return {
    id: identifier(row.creator_id), username, displayName: text(row.creator_nickname), avatar: null,
    region, currency, followers: numeric(row.creator_followers), likes: null, videoCount: null,
    gmv: numeric(row.revenue), itemsSold: numeric(row.sales_volumn), productCount: null,
    // These fields represent channel revenue, in the requested currency, not unit sales.
    videoSales: numeric(row.video_revenue), liveSales: numeric(row.live_revenue),
    views: numeric(row.content_views), growth: numeric(row.revenue_growth_rate),
  };
}
export function normalizeProfile(value: unknown, id: string, region: CreatorRegion, currency: string): CreatorProfile {
  if (value === null) throw new CreatorServiceError('CREATOR_NOT_FOUND', 404);
  if (!record(value)) throw new CreatorServiceError('UPSTREAM_ERROR', 502, true);
  const creator = normalizeCreator(value, region, currency);
  if (creator.id !== id) throw new CreatorServiceError('UPSTREAM_ERROR');
  // Undocumented/absent metrics stay null; fetch time is not the provider's update time.
  return { ...creator, bio: text(value.creator_bio), following: null, averagePrice: null,
    productCount: null, liveCount: null, engagement: null, updatedAt: null };
}
export function normalizeProduct(row: RawRow): CreatorProduct {
  // Signed image URLs expire in ~5 minutes, so never persist them in the 3-hour analytics cache.
  return { id: identifier(row.product_id), title: text(row.product_name), image: null,
    price: numeric(row.unit_price), revenue: numeric(row.revenue), itemsSold: numeric(row.sales_volumn),
    commission: numeric(row.commission_rate), shopName: null };
}
export function normalizeVideo(row: RawRow): CreatorVideo {
  return { id: identifier(row.video_id), description: text(row.video_title), cover: null,
    views: numeric(row.views), likes: numeric(row.digg_count), comments: numeric(row.comment_count),
    shares: numeric(row.share_count), revenue: numeric(row.revenue), itemsSold: null, publishedAt: null };
}
