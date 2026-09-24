-- Search Creator API: a paid subscription separate from the main Launchly app
-- subscription (tracked on public.users), plus the API keys issued against it.

-- ============================================================================
-- api_subscriptions — one row per user per product. Stripe is the source of
-- truth; this table mirrors it so requests can be authorized without calling
-- Stripe on every request.
-- ============================================================================
create table public.api_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product text not null default 'search_creator_api',
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'none'
    check (status in ('none', 'active', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- One current Search Creator API state per user (per product, so a second
  -- product can reuse this table later without a schema change).
  unique (user_id, product)
);

create index idx_api_subscriptions_user_id on public.api_subscriptions(user_id);
create index idx_api_subscriptions_stripe_subscription_id on public.api_subscriptions(stripe_subscription_id);
create index idx_api_subscriptions_product on public.api_subscriptions(product);
create index idx_api_subscriptions_status on public.api_subscriptions(status);

alter table public.api_subscriptions enable row level security;

create policy "Users can view own api subscription"
  on public.api_subscriptions for select
  using (auth.uid() = user_id);

create policy "Service role full access to api subscriptions"
  on public.api_subscriptions for all
  using (true)
  with check (true);

create trigger set_api_subscriptions_updated_at
  before update on public.api_subscriptions
  for each row execute function public.update_updated_at();

-- ============================================================================
-- api_keys — Launchly API keys issued against an active api_subscriptions
-- row. Only a hash of the full secret is ever stored.
-- ============================================================================
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Default API Key',
  key_prefix text not null,
  key_hash text not null unique,
  scope text not null default 'search_creator_api',
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index idx_api_keys_user_id on public.api_keys(user_id);
create index idx_api_keys_key_hash on public.api_keys(key_hash);
create index idx_api_keys_scope on public.api_keys(scope);
create index idx_api_keys_status on public.api_keys(status);

alter table public.api_keys enable row level security;

create policy "Users can view own api keys"
  on public.api_keys for select
  using (auth.uid() = user_id);

create policy "Service role full access to api keys"
  on public.api_keys for all
  using (true)
  with check (true);

-- ============================================================================
-- api_usage_events — lightweight, append-only request log for the public
-- Creator Search API. Never stores the secret key, only which key was used.
-- ============================================================================
create table public.api_usage_events (
  id bigint generated always as identity primary key,
  api_key_id uuid references public.api_keys(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  endpoint text not null,
  status_code integer not null,
  created_at timestamptz default now()
);

create index idx_api_usage_events_api_key_id on public.api_usage_events(api_key_id);
create index idx_api_usage_events_user_id_created_at on public.api_usage_events(user_id, created_at);

alter table public.api_usage_events enable row level security;

create policy "Users can view own api usage"
  on public.api_usage_events for select
  using (auth.uid() = user_id);

create policy "Service role full access to api usage events"
  on public.api_usage_events for all
  using (true)
  with check (true);
