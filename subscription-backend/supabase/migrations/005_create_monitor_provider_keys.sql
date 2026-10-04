-- Monitor: users' own AI provider keys, encrypted (AES-GCM) by the worker
-- with MONITOR_ENCRYPTION_KEY. Plain keys are never stored and never
-- returned to the browser — only key_last4 is ever shown.

create table public.monitor_provider_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('anthropic', 'openai', 'xai')),
  connection_type text not null check (connection_type in ('api', 'subscription')) default 'api',
  -- For API keys:
  key_ciphertext text,
  key_iv text,
  key_last4 text check (char_length(key_last4) = 4),
  -- For subscription (OAuth):
  access_token_ciphertext text,
  access_token_iv text,
  refresh_token_ciphertext text,
  refresh_token_iv text,
  scope text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, connection_type)
);

alter table public.monitor_provider_keys enable row level security;
-- No policies on purpose: browsers (anon/authenticated) can't read or write
-- this table at all. Only the worker's service role can.
