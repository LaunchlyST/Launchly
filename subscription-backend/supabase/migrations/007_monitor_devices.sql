-- A "device" is one computer running the local agent. Only the backend
-- (service role) ever writes here; the browser never sees the token.
create table if not exists public.monitor_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  status text not null default 'offline' check (status in ('offline', 'online')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.monitor_devices enable row level security;
create index if not exists monitor_devices_user on public.monitor_devices(user_id);

-- One execution task per coding request, so the frontend can poll it and the
-- Durable Object can persist its state across a restart.
create table if not exists public.monitor_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.monitor_devices(id) on delete cascade,
  project_id uuid not null references public.monitor_projects(id) on delete cascade,
  prompt text not null,
  status text not null default 'queued' check (status in ('queued', 'thinking', 'executing', 'waiting_for_tool', 'success', 'error', 'cancelled')),
  activity jsonb not null default '[]',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.monitor_tasks enable row level security;
create index if not exists monitor_tasks_user on public.monitor_tasks(user_id);
