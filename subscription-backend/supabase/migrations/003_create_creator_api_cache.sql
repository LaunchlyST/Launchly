-- Cache for the Search Creator API's upstream (Kalodata) responses. The
-- customer-facing plan is unlimited searches, so repeated/duplicate lookups
-- must not hit the upstream provider every time.

create table public.creator_api_cache (
  id bigint generated always as identity primary key,
  cache_key text not null unique,
  query text not null,
  region text,
  endpoint text not null default 'search',
  response jsonb not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

create index idx_creator_api_cache_cache_key on public.creator_api_cache(cache_key);
create index idx_creator_api_cache_expires_at on public.creator_api_cache(expires_at);

alter table public.creator_api_cache enable row level security;

-- No end-user reads this table directly — only the worker, via the service
-- role key, on behalf of an already-authorized Creator API request.
create policy "Service role full access to creator api cache"
  on public.creator_api_cache for all
  using (true)
  with check (true);
