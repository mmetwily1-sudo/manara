-- 062: جلسات اللايف (رابط يدوي + حضور)
create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  group_id uuid references public.groups(id) on delete set null,
  starts_at timestamptz not null,
  join_url text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.live_attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);
create index if not exists live_sessions_tenant on public.live_sessions(tenant_id, starts_at);
