/**
 * All Supabase access for Launchly's own creator-data tables
 * (`creators`, `creator_videos`, `creator_snapshots`) lives here — route
 * handlers and creatorSearchService.ts never write SQL/Supabase calls
 * directly.
 */
import { createClient } from '@supabase/supabase-js';
import type { Env } from './types';
import type { LaunchlyCreator, LaunchlyCreatorVideo } from './creatorTypes';

function getSupabase(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

interface StoredCreator {
  row: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    region: string | null;
    followers: number | null;
    following: number | null;
    likes: number | null;
    video_count: number | null;
    avg_views: number | null;
    avg_likes: number | null;
    avg_comments: number | null;
    avg_shares: number | null;
    engagement_rate: number | null;
    posting_frequency_per_week: number | null;
    last_collected_at: string;
  };
  ageMs: number;
}

/** The most recent stored row for a username, if any — regardless of freshness. */
export async function getCreatorByUsername(env: Env, username: string): Promise<StoredCreator | null> {
  const supabase = getSupabase(env);
  const { data } = await supabase
    .from('creators')
    .select(
      'id, username, display_name, avatar_url, bio, region, followers, following, likes, video_count, avg_views, avg_likes, avg_comments, avg_shares, engagement_rate, posting_frequency_per_week, last_collected_at'
    )
    .eq('platform', 'tiktok')
    .eq('username', username)
    .maybeSingle();

  if (!data) return null;
  return { row: data, ageMs: Date.now() - new Date(data.last_collected_at).getTime() };
}

/** Same as above, but null unless the row is within `maxAgeMs`. */
export async function getFreshCreator(env: Env, username: string, maxAgeMs: number): Promise<StoredCreator | null> {
  const stored = await getCreatorByUsername(env, username);
  if (!stored || stored.ageMs > maxAgeMs) return null;
  return stored;
}

export function storedCreatorToLaunchlyCreator(stored: StoredCreator): LaunchlyCreator {
  const r = stored.row;
  return {
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    avatar: r.avatar_url,
    bio: r.bio,
    region: r.region,
    followers: r.followers,
    following: r.following,
    likes: r.likes,
    videoCount: r.video_count,
    avgViews: r.avg_views,
    avgLikes: r.avg_likes,
    avgComments: r.avg_comments,
    avgShares: r.avg_shares,
    engagementRate: r.engagement_rate,
    postingFrequencyPerWeek: r.posting_frequency_per_week,
    updatedAt: r.last_collected_at,
  };
}

/** Insert or update the one row per (platform, username). Returns the row id. */
export async function upsertCreator(env: Env, creator: LaunchlyCreator): Promise<string | null> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase
    .from('creators')
    .upsert(
      {
        platform: 'tiktok',
        platform_creator_id: creator.id,
        username: creator.username,
        display_name: creator.displayName,
        avatar_url: creator.avatar,
        bio: creator.bio,
        region: creator.region,
        followers: creator.followers,
        following: creator.following,
        likes: creator.likes,
        video_count: creator.videoCount,
        avg_views: creator.avgViews,
        avg_likes: creator.avgLikes,
        avg_comments: creator.avgComments,
        avg_shares: creator.avgShares,
        engagement_rate: creator.engagementRate,
        posting_frequency_per_week: creator.postingFrequencyPerWeek,
        last_collected_at: creator.updatedAt,
      },
      { onConflict: 'platform,username' }
    )
    .select('id')
    .maybeSingle();

  if (error) return null;
  return data?.id ?? null;
}

export async function upsertCreatorVideos(env: Env, creatorId: string, videos: LaunchlyCreatorVideo[]): Promise<void> {
  if (!creatorId || videos.length === 0) return;
  const supabase = getSupabase(env);
  const now = new Date().toISOString();

  const withPlatformId = videos.filter((v) => v.id);
  const withoutPlatformId = videos.filter((v) => !v.id);

  if (withPlatformId.length > 0) {
    await supabase.from('creator_videos').upsert(
      withPlatformId.map((v) => ({
        creator_id: creatorId,
        platform_video_id: v.id,
        description: v.description,
        cover_url: v.cover,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        shares: v.shares,
        published_at: v.publishedAt,
        last_collected_at: now,
      })),
      { onConflict: 'platform_video_id' }
    );
  }
  // Videos without a platform id can't be deduplicated — inserted plainly.
  if (withoutPlatformId.length > 0) {
    await supabase.from('creator_videos').insert(
      withoutPlatformId.map((v) => ({
        creator_id: creatorId,
        platform_video_id: null,
        description: v.description,
        cover_url: v.cover,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        shares: v.shares,
        published_at: v.publishedAt,
        last_collected_at: now,
      }))
    );
  }
}

export async function getRecentVideos(env: Env, creatorId: string, limit = 12): Promise<LaunchlyCreatorVideo[]> {
  const supabase = getSupabase(env);
  const { data } = await supabase
    .from('creator_videos')
    .select('platform_video_id, description, cover_url, views, likes, comments, shares, published_at')
    .eq('creator_id', creatorId)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  return (data ?? []).map((v) => ({
    id: v.platform_video_id,
    description: v.description,
    cover: v.cover_url,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    shares: v.shares,
    publishedAt: v.published_at,
  }));
}

export async function insertCreatorSnapshot(env: Env, creatorId: string, creator: LaunchlyCreator): Promise<void> {
  if (!creatorId) return;
  const supabase = getSupabase(env);
  await supabase.from('creator_snapshots').insert({
    creator_id: creatorId,
    followers: creator.followers,
    following: creator.following,
    likes: creator.likes,
    video_count: creator.videoCount,
    avg_views: creator.avgViews,
    engagement_rate: creator.engagementRate,
  });
}
