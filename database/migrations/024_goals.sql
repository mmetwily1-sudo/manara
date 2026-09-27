-- 024: أهداف الطلاب (تقدم محسوب تلقائياً من البيانات)
create table if not exists public.student_goals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  kind text not null default 'points' check (kind in ('points','attendance','exam_avg')),
  target int not null default 100,
  deadline date,
  status text not null default 'active' check (status in ('active','done','cancelled')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists goals_student on public.student_goals(tenant_id, student_id, status);
