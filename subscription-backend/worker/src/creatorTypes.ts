/**
 * Launchly's own creator-data shape. Nothing outside this module (and the
 * repository/collector/normalizer that fill it in) should know or care that
 * the underlying source is TikTok's public profile page — every consumer,
 * internal or external, depends on this interface only.
 */

export interface LaunchlyCreator {
  id: string | null;
  username: string;
  displayName: string | null;
  avatar: string | null;
  bio: string | null;
  /** The creator's own detected region — null unless reliably known. Not to be confused with a request's `region` query param. */
  region: string | null;
  followers: number | null;
  following: number | null;
  likes: number | null;
  videoCount: number | null;
  /** Launchly-calculated from recentVideos, not platform-provided. */
  avgViews: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  avgShares: number | null;
  /** Launchly-calculated: (avgLikes + avgComments + avgShares) / avgViews * 100. */
  engagementRate: number | null;
  /** Launchly-calculated from recent video publish timestamps. */
  postingFrequencyPerWeek: number | null;
  updatedAt: string;
}

export interface LaunchlyCreatorVideo {
  id: string | null;
  description: string | null;
  cover: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  publishedAt: string | null;
}

export interface LaunchlyCreatorSearchResult {
  creator: LaunchlyCreator;
  recentVideos: LaunchlyCreatorVideo[];
  /** True only when this response was served from storage older than the freshness window because a live refresh failed. */
  stale?: boolean;
}
