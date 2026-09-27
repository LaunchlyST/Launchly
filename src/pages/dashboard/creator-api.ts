import { supabase } from '../../lib/supabase';
import { creatorMarkets, normalizeCreatorQuery, validCreatorQuery, type CreatorRegion, type CreatorSearchResult, type CreatorProfile, type CreatorProduct, type CreatorVideo as ApiVideo, type CreatorSearchResponse, type CreatorResponse, type Pagination } from '../../../shared/creator-contract';
export type Market = CreatorRegion;
export type Period = 7 | 30 | 90 | 180 | 365;
export type Metric = 'revenue' | 'itemsSold' | 'views' | 'videos';
export type Metrics = {
    revenue?: number;
    itemsSold?: number;
    productsPromoted?: number;
    videos?: number;
    views?: number;
    averageViews?: number;
    engagementRate?: number;
    growth?: number;
};
export type Product = {
    id: string;
    name: string;
    image?: string;
    url?: string;
    price?: number;
    revenue?: number;
    itemsSold?: number;
    commission?: number;
    videos?: number;
};
export type CreatorVideo = {
    id: string;
    thumbnail?: string;
    url?: string;
    product?: string;
    postedAt?: string;
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    itemsSold?: number;
    revenue?: number;
};
export type Analytics = {
    metrics: Metrics;
    series: ({
        date: string;
    } & Partial<Record<Metric, number>>)[];
    products: Product[];
    videos: CreatorVideo[];
    categories: {
        name: string;
        percentage: number;
    }[];
};
export type Creator = {
    id?: string;
    stale?: boolean;
    bio?: string;
    detailWarning?: string;
    username: string;
    displayName?: string;
    market: Market;
    avatar?: string;
    followers?: number;
    following?: number;
    likes?: number;
    niche?: string;
    currency?: string;
    updatedAt?: string;
    analytics: Partial<Record<Period, Analytics>>;
};

export type SearchResult = { status: 'found'; creator: Creator } | { status: 'not_found' | 'market_mismatch' | 'unavailable' | 'unauthorized' | 'subscription_required' | 'rate_limited' };
export const markets = creatorMarkets;
export const normalizeUsername = normalizeCreatorQuery;
export const validUsername = validCreatorQuery;
export function safeUrl(value?: string) { try { const url = new URL(value || ''); return url.protocol === 'https:' ? url.href : undefined; } catch { return undefined; } }
export function number(value?: number, suffix = '') { return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en', { notation: Math.abs(value) >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 2 }).format(value) + suffix : '—'; }
export function money(value: number | undefined, currency = 'USD') { return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value) : '—'; }
export class CreatorRequestError extends Error {
    constructor(public code: string, message: string) { super(message); }
}
export async function creatorRequest<T>(path: string, parameters: Record<string, string>, signal: AbortSignal): Promise<{ data: T; stale: boolean }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new CreatorRequestError('UNAUTHORIZED', 'Sign in to search creators.');
    const url = new URL('/api/launchly/creators/' + path, import.meta.env.VITE_WORKER_URL || window.location.origin);
    url.search = new URLSearchParams(parameters).toString();
    const response = await fetch(url, { signal, headers: { Accept: 'application/json', Authorization: 'Bearer ' + session.access_token }, cache: 'no-store' });
    const result = await response.json() as CreatorResponse<T>;
    if (!result.success) {
        const failure = result as { error?: { code?: string; message?: string } };
        const code = failure.error?.code || 'UPSTREAM_ERROR';
        const messages: Record<string,string> = { UNAUTHORIZED: 'Sign in to search creators.', SUBSCRIPTION_REQUIRED: 'An active £5/month Launchly Creator API subscription is required.', RATE_LIMITED: 'Please wait a moment and try again.', INVALID_QUERY: 'Enter a creator username and selected market.', CREATOR_NOT_FOUND: 'No creator found. Check the username and selected market.' };
        throw new CreatorRequestError(code, messages[code] || 'Unable to load creator data. Please try again.');
    }
    if (!response.ok) throw new CreatorRequestError('UPSTREAM_ERROR', 'Unable to load creator data. Please try again.');
    return { data: result.data, stale: result.stale === true };
}
export function adaptCreator(c: CreatorSearchResult | CreatorProfile, period: Period, stale = false): Creator {
    if (!c || !c.id || typeof c.username !== 'string' || !Object.prototype.hasOwnProperty.call(markets, c.region)) throw new CreatorRequestError('UPSTREAM_ERROR', 'Unable to load creator data. Please try again.');
    const profile = c as CreatorProfile;
    return { id: c.id, username: c.username, displayName: c.displayName ?? undefined, market: c.region,
        avatar: c.avatar ?? undefined, followers: c.followers ?? undefined, following: profile.following ?? undefined,
        likes: c.likes ?? undefined, currency: c.currency, updatedAt: profile.updatedAt ?? undefined, bio: profile.bio ?? undefined, stale,
        analytics: { [period]: { metrics: { revenue: c.gmv ?? undefined, itemsSold: c.itemsSold ?? undefined,
            productsPromoted: c.productCount ?? undefined, videos: c.videoCount ?? undefined,
            views: c.views ?? undefined, engagementRate: profile.engagement ?? undefined }, series: [], products: [], videos: [], categories: [] } } };
}
export async function searchCreators(query: string, region: Market, period: Period, page: number, pageSize: number, signal: AbortSignal) {
    const result = await creatorRequest<CreatorSearchResponse>('search', { q: normalizeUsername(query), region, period: String(period), page: String(page), pageSize: String(pageSize) }, signal);
    if (!Array.isArray(result.data.creators) || !result.data.pagination) throw new CreatorRequestError('UPSTREAM_ERROR', 'Unable to load creator data. Please try again.');
    return { creators: result.data.creators.map(c => { if (c.region !== region) throw new CreatorRequestError('UPSTREAM_ERROR', 'Unable to load creator data. Please try again.'); return adaptCreator(c, period, result.stale); }), pagination: result.data.pagination, stale: result.stale };
}
export async function loadCreatorDetails(creator: Creator, period: Period, signal: AbortSignal): Promise<Creator> {
    if (!creator.id) throw new CreatorRequestError('CREATOR_NOT_FOUND', 'Search for this creator again to load current analytics.');
    const params = { region: creator.market, period: String(period) };
    const profile = await creatorRequest<CreatorProfile>(encodeURIComponent(creator.id), params, signal);
    if (profile.data.id !== creator.id || profile.data.region !== creator.market) throw new CreatorRequestError('UPSTREAM_ERROR', 'Unable to load creator data. Please try again.');
    const result = adaptCreator(profile.data, period, profile.stale);
    // Product/video ranking endpoints support at most 30 days. Never substitute another window.
    if (period > 30) { result.detailWarning = 'Product and video lists are available for 7- and 30-day periods.'; return result; }
    const responses = await Promise.allSettled([
        creatorRequest<{ products: CreatorProduct[]; pagination: Pagination }>(creator.id + '/products', params, signal),
        creatorRequest<{ videos: ApiVideo[]; pagination: Pagination }>(creator.id + '/videos', params, signal),
    ]);
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const [products, videos] = responses;
    const analytics = result.analytics[period]!;
    if (products.status === 'fulfilled') {
        analytics.products = products.value.data.products.map(p => ({ id: p.id, name: p.title || 'Product', price: p.price ?? undefined, revenue: p.revenue ?? undefined, itemsSold: p.itemsSold ?? undefined, commission: p.commission === null ? undefined : p.commission * 100 }));
        result.stale ||= products.value.stale;
    }
    if (videos.status === 'fulfilled') {
        analytics.videos = videos.value.data.videos.map(v => ({ id: v.id, product: v.description ?? undefined, views: v.views ?? undefined, likes: v.likes ?? undefined, comments: v.comments ?? undefined, shares: v.shares ?? undefined, revenue: v.revenue ?? undefined, itemsSold: v.itemsSold ?? undefined, postedAt: v.publishedAt ?? undefined }));
        result.stale ||= videos.value.stale;
    }
    if (responses.some(r => r.status === 'rejected')) result.detailWarning = 'Some product or video data could not be loaded. Retry to refresh.';
    else result.detailWarning = 'Showing up to 20 products and 20 videos, ranked by revenue.';
    return result;
}
// Compatibility for existing saved-creator/history actions.
export async function searchCreator(username: string, market: Market, period: Period, signal: AbortSignal): Promise<SearchResult> {
    try {
        const result = await searchCreators(username, market, period > 30 ? 30 : period, 1, 20, signal);
        const creator = result.creators.find(c => normalizeUsername(c.username) === normalizeUsername(username));
        if (!creator) return { status: 'not_found' };
        return { status: 'found', creator: period > 30 ? await loadCreatorDetails(creator, period, signal) : creator };
    } catch (error) {
        if (signal.aborted) throw error;
        const code = error instanceof CreatorRequestError ? error.code : '';
        return { status: code === 'UNAUTHORIZED' ? 'unauthorized' : code === 'SUBSCRIPTION_REQUIRED' ? 'subscription_required' : code === 'RATE_LIMITED' ? 'rate_limited' : 'unavailable' };
    }
}
