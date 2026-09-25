-- Launchly's own creator-data system, replacing the earlier
-- Kalodata-upstream design. Real data only, collected from public TikTok
-- profile pages by the worker (see worker/src/tiktokPublicCollector.ts) —
-- no third-party analytics API is used.

create table public.creators (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'tiktok',
  platform_creator_id text,
  username text not null,
  display_name text,
  avatar_url text,
  bio text,
  -- The creator's own detected region, if ever reliably known. Null in v1 —
  -- not derivable from a public profile page, and never guessed.
  region text,
  followers bigint,
  following bigint,
  likes bigint,
  video_count integer,
  -- Launchly-calculated from recent collected videos, not platform-provided.
  avg_views bigint,
  avg_likes bigint,
  avg_comments bigint,
  avg_shares bigint,
  engagement_rate numeric,
  posting_frequency_per_week numeric,
  last_collected_at timestamptz not null default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (platform, username)
);

create index idx_creators_username on public.creators(username);
create index idx_creators_last_collected_at on public.creators(last_collected_at);

alter table public.creators enable row level security;

-- Only the worker (service role) reads/writes this table today — there is
-- no direct end-user access to creator rows.
create policy "Service role full access to creators"
  on public.creators for all
  using (true)
  with check (true);

create trigger set_creators_updated_at
  before update on public.creators
  for each row execute function public.update_updated_at();

create table public.creator_videos (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  platform_video_id text,
  description text,
  cover_url text,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  published_at timestamptz,
  last_collected_at timestamptz not null default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Deduplicates re-collected videos that do carry a platform id. Videos
  -- without one (public-page parsing didn't yield an id) are inserted
  -- plainly and simply age out of the "recent" query over time.
  unique (platform_video_id)
);

create index idx_creator_videos_creator_id on public.creator_videos(creator_id);
create index idx_creator_videos_published_at on public.creator_videos(published_at);

alter table public.creator_videos enable row level security;

create policy "Service role full access to creator videos"
  on public.creator_videos for all
  using (true)
  with check (true);

create trigger set_creator_videos_updated_at
  before update on public.creator_videos
  for each row execute function public.update_updated_at();

-- Historical tracking: one row per collection, so growth over time can be
-- charted later without needing to have planned for it in advance.
create table public.creator_snapshots (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  followers bigint,
  following bigint,
  likes bigint,
  video_count integer,
  avg_views bigint,
  engagement_rate numeric,
  captured_at timestamptz not null default now()
);

create index idx_creator_snapshots_creator_id on public.creator_snapshots(creator_id);
create index idx_creator_snapshots_captured_at on public.creator_snapshots(captured_at);

alter table public.creator_snapshots enable row level security;

create policy "Service role full access to creator snapshots"
  on public.creator_snapshots for all
  using (true)
  with check (true);
