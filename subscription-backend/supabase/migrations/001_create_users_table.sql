-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table with subscription tracking
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text default 'inactive' check (subscription_status in ('active', 'inactive', 'cancelled', 'past_due')),
  subscription_current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for faster lookups
create index idx_users_stripe_customer_id on public.users(stripe_customer_id);
create index idx_users_stripe_subscription_id on public.users(stripe_subscription_id);

-- RLS policies
alter table public.users enable row level security;

-- Users can read their own data
create policy "Users can view own data"
  on public.users for select
  using (auth.uid() = id);

-- Users can update their own data (limited fields)
create policy "Users can update own data"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Service role can do everything (for webhook worker)
create policy "Service role full access"
  on public.users for all
  using (true)
  with check (true);

-- Function to auto-create user on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Function to update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for updated_at
create trigger set_updated_at
  before update on public.users
  for each row execute function public.update_updated_at();
