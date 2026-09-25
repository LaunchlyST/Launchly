/**
 * Launchly's own analytics, calculated only from real collected video
 * numbers — never platform-provided, always derived here so there's one
 * place that defines what "average views" or "engagement rate" means.
 */
import type { LaunchlyCreatorVideo } from './creatorTypes';

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round(sum / values.length);
}

export interface CreatorMetrics {
  avgViews: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  avgShares: number | null;
  engagementRate: number | null;
  postingFrequencyPerWeek: number | null;
}

export function calculateCreatorMetrics(videos: LaunchlyCreatorVideo[]): CreatorMetrics {
  const views = videos.map((v) => v.views).filter((n): n is number => typeof n === 'number');
  const likes = videos.map((v) => v.likes).filter((n): n is number => typeof n === 'number');
  const comments = videos.map((v) => v.comments).filter((n): n is number => typeof n === 'number');
  const shares = videos.map((v) => v.shares).filter((n): n is number => typeof n === 'number');

  const avgViews = average(views);
  const avgLikes = average(likes);
  const avgComments = average(comments);
  const avgShares = average(shares);

  const engagementRate =
    avgViews && avgViews > 0
      ? Math.round((((avgLikes ?? 0) + (avgComments ?? 0) + (avgShares ?? 0)) / avgViews) * 1000) / 10
      : null;

  const publishedTimestamps = videos
    .map((v) => (v.publishedAt ? new Date(v.publishedAt).getTime() : null))
    .filter((n): n is number => typeof n === 'number' && !Number.isNaN(n))
    .sort((a, b) => a - b);

  let postingFrequencyPerWeek: number | null = null;
  if (publishedTimestamps.length >= 2) {
    const spanMs = publishedTimestamps[publishedTimestamps.length - 1] - publishedTimestamps[0];
    const spanWeeks = spanMs / (7 * 24 * 60 * 60 * 1000);
    if (spanWeeks > 0) {
      postingFrequencyPerWeek = Math.round((publishedTimestamps.length / spanWeeks) * 10) / 10;
    }
  }

  return { avgViews, avgLikes, avgComments, avgShares, engagementRate, postingFrequencyPerWeek };
}
