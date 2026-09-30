-- Server-only OAuth state and encrypted GitHub credentials.
create table public.monitor_github_oauth (
  state uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  verifier text not null,
  expires_at timestamptz not null
);
alter table public.monitor_github_oauth enable row level security;
create table public.monitor_github_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login text not null,
  token_ciphertext text not null,
  token_iv text not null
);
alter table public.monitor_github_accounts enable row level security;
