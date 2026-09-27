-- Remove browser-write access to billing fields before trusting subscription rows.
drop policy if exists "Users can update own data" on public.users;
drop policy if exists "Service role full access" on public.users;
create policy "Service role full access" on public.users for all to service_role using (true) with check (true);
revoke insert, update, delete on public.users from anon, authenticated;

create table public.creator_api_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text unique not null,
  creator_id text,
  query text,
  region text,
  endpoint text,
  response jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
-- The unique constraint already supplies the cache_key index.
create index creator_api_cache_expiry on public.creator_api_cache(expires_at);
create index creator_api_cache_creator on public.creator_api_cache(creator_id);
alter table public.creator_api_cache enable row level security;
revoke all on public.creator_api_cache from anon, authenticated;
grant all on public.creator_api_cache to service_role;

create table public.creator_request_leases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null,
  started_at timestamptz not null default now(),
  released boolean not null default false
);
create index creator_request_leases_user_time on public.creator_request_leases(user_id, started_at);
alter table public.creator_request_leases enable row level security;
revoke all on public.creator_request_leases from anon, authenticated;
grant all on public.creator_request_leases to service_role;

create or replace function public.acquire_creator_request(p_user_id uuid, p_cache_key text)
returns uuid language plpgsql security definer set search_path = public as $$
declare lease_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  delete from creator_request_leases where user_id = p_user_id and started_at < now() - interval '1 minute';
  if (select count(*) from creator_request_leases where user_id = p_user_id) >= 30
    or (select count(*) from creator_request_leases where user_id = p_user_id and not released and started_at > now() - interval '30 seconds') >= 3
    or exists(select 1 from creator_request_leases where user_id = p_user_id and cache_key = p_cache_key and
      (started_at > now() - interval '1 second' or (not released and started_at > now() - interval '30 seconds')))
  then return null; end if;
  insert into creator_request_leases(user_id, cache_key) values(p_user_id, p_cache_key) returning id into lease_id;
  return lease_id;
end;
$$;
revoke all on function public.acquire_creator_request(uuid, text) from public, anon, authenticated;
grant execute on function public.acquire_creator_request(uuid, text) to service_role;

-- Periodic maintenance (optional scheduler): delete expired cache older than 24 hours
-- and leases older than a day. Recently expired cache is kept for outage fallback.
