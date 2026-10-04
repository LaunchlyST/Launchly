-- GitHub App support: user-to-server tokens expire (8h) and can be renewed
-- with the rotating refresh token. OAuth-App tokens have no expiry; the
-- new columns stay NULL for those rows and behavior is unchanged.
alter table public.monitor_github_accounts
  add column if not exists refresh_token_ciphertext text,
  add column if not exists refresh_token_iv text,
  add column if not exists token_expires_at timestamptz;
