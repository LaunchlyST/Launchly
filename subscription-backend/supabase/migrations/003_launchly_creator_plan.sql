-- Written only by verified Stripe webhooks; never grant based on an old active flag.
alter table public.users add column if not exists subscription_price_id text;
alter table public.users add column if not exists creator_api_plan_verified boolean not null default false;

-- Preserve the service-role-only billing writes even if this migration is applied separately.
drop policy if exists "Users can update own data" on public.users;
drop policy if exists "Service role full access" on public.users;
create policy "Service role full access" on public.users for all to service_role using (true) with check (true);
revoke insert, update, delete on public.users from anon, authenticated;

-- Existing subscribers need a verified subscription update/webhook replay to populate
-- these fields from the actual Stripe price. Do not backfill true from subscription_status.
