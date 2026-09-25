/**
 * Converts a raw collector result into Launchly's own creator/video shape.
 * This is the only place that should ever read TikTok-specific field names
 * — everything downstream works with LaunchlyCreator/LaunchlyCreatorVideo.
 */
import type { RawCreatorProfile } from './tiktokPublicCollector';
import type { LaunchlyCreator, LaunchlyCreatorVideo } from './creatorTypes';
import { calculateCreatorMetrics } from './creatorMetrics';

export function normalizeCreatorVideos(raw: RawCreatorProfile): LaunchlyCreatorVideo[] {
  return raw.videos.map((v) => ({
    id: v.id,
    description: v.description,
    cover: v.cover,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    shares: v.shares,
    publishedAt: v.publishedAt,
  }));
}

export function normalizeCreator(raw: RawCreatorProfile, recentVideos: LaunchlyCreatorVideo[]): LaunchlyCreator {
  const metrics = calculateCreatorMetrics(recentVideos);
  return {
    id: raw.platformCreatorId,
    username: raw.username,
    displayName: raw.displayName,
    avatar: raw.avatar,
    bio: raw.bio,
    // Not reliably derivable from a public profile page — never guessed.
    region: null,
    followers: raw.followers,
    following: raw.following,
    likes: raw.likes,
    videoCount: raw.videoCount,
    avgViews: metrics.avgViews,
    avgLikes: metrics.avgLikes,
    avgComments: metrics.avgComments,
    avgShares: metrics.avgShares,
    engagementRate: metrics.engagementRate,
    postingFrequencyPerWeek: metrics.postingFrequencyPerWeek,
    updatedAt: new Date().toISOString(),
  };
}
