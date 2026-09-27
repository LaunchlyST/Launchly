-- Only a trusted workspace/bridge service may create connected projects after
-- authentication and successful workspace provisioning. No browser inserts.
create table if not exists public.monitor_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('github', 'local', 'git-url')),
  name text not null,
  repository text not null,
  branch text not null,
  status text not null check (status in ('synced', 'syncing', 'error')),
  workspace_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, workspace_id)
);
alter table public.monitor_projects enable row level security;
create index if not exists monitor_projects_user on public.monitor_projects(user_id);
