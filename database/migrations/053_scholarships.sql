-- 053: المنح الدراسية (خصم % دائم يطبق عند إصدار الفواتير)
create table if not exists public.scholarships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  pct int not null check (pct between 1 and 100),
  reason text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, student_id)
);
create index if not exists scholarships_tenant on public.scholarships(tenant_id, active);
