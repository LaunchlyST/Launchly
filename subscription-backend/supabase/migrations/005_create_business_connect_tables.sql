-- Business Connect: saved leads, verified social profiles, notes, outreach,
-- plus a worker-only response cache.
--
-- Every user-owned table is protected by RLS so a signed-in user can only
-- ever see their own rows. The worker uses the service role and scopes every
-- query by the authenticated user id as well.

create table public.business_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_business_id text not null,
  name text not null,
  category text,
  address text,
  city text,
  country text,
  phone text,
  website text,
  rating numeric,
  review_count integer,
  image_url text,
  -- A rules-based estimate (see worker/src/business/adBudget.ts), never actual spend.
  estimated_budget_min integer,
  estimated_budget_max integer,
  estimated_budget_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, provider_business_id)
);

create index idx_business_leads_user_id on public.business_leads(user_id);

alter table public.business_leads enable row level security;

create policy "Users read own business leads"
  on public.business_leads for select using (auth.uid() = user_id);
create policy "Users insert own business leads"
  on public.business_leads for insert with check (auth.uid() = user_id);
create policy "Users update own business leads"
  on public.business_leads for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own business leads"
  on public.business_leads for delete using (auth.uid() = user_id);

create trigger set_business_leads_updated_at
  before update on public.business_leads
  for each row execute function public.update_updated_at();

create table public.business_social_profiles (
  id uuid primary key default gen_random_uuid(),
  business_lead_id uuid not null references public.business_leads(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'facebook', 'youtube', 'tiktok', 'linkedin')),
  profile_url text not null,
  username text,
  -- Where the link was found: provider, business_website, structured_data.
  source text not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  verified_at timestamptz not null default now(),

  unique (business_lead_id, platform)
);

alter table public.business_social_profiles enable row level security;

create policy "Users read social profiles of own leads"
  on public.business_social_profiles for select
  using (exists (select 1 from public.business_leads l where l.id = business_lead_id and l.user_id = auth.uid()));

create table public.business_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_lead_id uuid not null references public.business_leads(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index idx_business_notes_lead on public.business_notes(business_lead_id);

alter table public.business_notes enable row level security;

create policy "Users manage own business notes"
  on public.business_notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.business_outreach (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_lead_id uuid not null references public.business_leads(id) on delete cascade,
  channel text not null check (channel in ('email', 'message', 'follow_up')),
  subject text,
  body text not null,
  status text not null check (status in ('draft', 'scheduled', 'sent', 'replied', 'failed')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_business_outreach_lead on public.business_outreach(business_lead_id);

alter table public.business_outreach enable row level security;

create policy "Users manage own business outreach"
  on public.business_outreach for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Worker-only cache of provider searches, business details and website
-- inspections, so repeated lookups never re-hit external sources.
create table public.business_cache (
  cache_key text primary key,
  response jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_business_cache_expires_at on public.business_cache(expires_at);

alter table public.business_cache enable row level security;
-- No policies: only the service role (which bypasses RLS) can touch it.
