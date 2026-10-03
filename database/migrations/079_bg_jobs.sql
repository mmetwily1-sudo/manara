-- 079: طابور المهام الخلفية (بديل Redis على Hobby — Postgres نفسه + UptimeRobot)
create table if not exists public.bg_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  dedupe_key text unique,
  status text not null default 'queued' check (status in ('queued','running','done','failed','dead')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  run_at timestamptz not null default now(),
  leased_at timestamptz,
  lease_token text,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists bg_jobs_due on public.bg_jobs(status, run_at) where status = 'queued';
