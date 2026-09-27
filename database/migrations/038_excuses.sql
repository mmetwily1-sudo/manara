-- 038: أعذار الغياب (طلب + اعتماد يستثني من التصعيد)
create table if not exists public.absence_excuses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by uuid references public.users(id) on delete set null,
  decided_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists excuses_student on public.absence_excuses(tenant_id, student_id, status);
