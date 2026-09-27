-- 042: المحادثات المباشرة (طالب/ولي أمر ↔ معلم)
create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  thread_id uuid not null references public.threads(id) on delete cascade,
  teacher_id uuid not null references public.users(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (tenant_id, teacher_id, student_id)
);
create index if not exists dm_lookup on public.dm_threads(tenant_id, teacher_id, student_id);
