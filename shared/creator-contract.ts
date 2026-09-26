export const creatorMarkets = {
  GB: { name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP' },
  US: { name: 'United States', flag: '🇺🇸', currency: 'USD' },
} as const;
export type CreatorRegion = keyof typeof creatorMarkets;
export const LAUNCHLY_CREATOR_SERVICE = 'Launchly Creator API' as const;
export interface LaunchlyCreator {
  id: string; username: string; displayName: string | null; avatar: string | null;
  region: CreatorRegion; currency: string; followers: number | null; likes: number | null;
  videoCount: number | null; gmv: number | null; itemsSold: number | null;
  productCount: number | null; videoSales: number | null; liveSales: number | null;
  views: number | null; growth: number | null;
}
export type CreatorSearchResult = LaunchlyCreator;
export interface LaunchlyCreatorSearchResponse {
  success: true;
  service: typeof LAUNCHLY_CREATOR_SERVICE;
  data: { creators: LaunchlyCreator[]; pagination: Pagination };
  stale?: boolean;
}
export interface CreatorProfile extends CreatorSearchResult {
  bio: string | null; following: number | null; averagePrice: number | null;
  productCount: number | null; liveCount: number | null; engagement: number | null;
  updatedAt: string | null;
}
export interface CreatorProduct {
  id: string; title: string | null; image: string | null; price: number | null;
  revenue: number | null; itemsSold: number | null; commission: number | null; shopName: string | null;
}
export interface CreatorVideo {
  id: string; cover: string | null; description: string | null; views: number | null;
  likes: number | null; comments: number | null; shares: number | null;
  revenue: number | null; itemsSold: number | null; publishedAt: string | null;
}
export interface Pagination { page: number; pageSize: number; hasMore: boolean }
export interface CreatorSearchResponse { creators: CreatorSearchResult[]; pagination: Pagination }
export type CreatorErrorCode = 'INVALID_QUERY' | 'CREATOR_NOT_FOUND' | 'UNAUTHORIZED' |
  'SUBSCRIPTION_REQUIRED' | 'RATE_LIMITED' | 'UPSTREAM_ERROR' | 'SERVER_ERROR';
export interface CreatorApiError { success: false; service: typeof LAUNCHLY_CREATOR_SERVICE; error: { code: CreatorErrorCode; message: string } }
export type CreatorResponse<T> = { success: true; service: typeof LAUNCHLY_CREATOR_SERVICE; data: T; stale?: boolean } | CreatorApiError;

export function normalizeCreatorQuery(input: string): string {
  let value = input.trim();
  if (/^(https?:\/\/|(?:www\.)?tiktok\.com\/)/i.test(value)) {
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
      if (!['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'].includes(url.hostname.toLowerCase())) return '';
      value = decodeURIComponent(url.pathname.match(/^\/@([^/]+)\/?$/)?.[1] || '');
    } catch { return ''; }
  }
  return value.replace(/^@+/, '').trim().toLowerCase();
}
export const validCreatorQuery = (value: string) => {
  const query = normalizeCreatorQuery(value);
  return query.length > 0 && query.length <= 64 && !/[\x00-\x1f<>/\\:]/.test(query);
};
