-- TikTok Login Kit connections for Creator Store profile sync.
-- open_id is the stable TikTok account id (username changes never break sync).
-- Tokens live here (service-role only); the browser only receives safe profile fields.

create table if not exists public.tiktok_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  open_id text not null unique,
  username text not null default '',
  display_name text not null default '',
  avatar_url text not null default '',
  bio text not null default '',
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  profile_fetched_at timestamptz,
  last_synced_at timestamptz,
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tiktok_connections enable row level security;

-- No direct client access: only the Worker service role reads/writes tokens.
drop policy if exists "tiktok_no_client_access" on public.tiktok_connections;
create policy "tiktok_no_client_access" on public.tiktok_connections
  for all using (false) with check (false);

create index if not exists tiktok_connections_open_id_idx on public.tiktok_connections (open_id);
create index if not exists tiktok_connections_last_synced_idx on public.tiktok_connections (last_synced_at);
