-- 047: مسير الرواتب (شهر + بنود + اعتماد)
create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  month text not null,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, month)
);
create table if not exists public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  run_id uuid not null references public.payroll_runs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  base numeric not null default 0,
  bonus numeric not null default 0,
  deduction numeric not null default 0,
  net numeric not null default 0,
  note text not null default '',
  unique (run_id, user_id)
);
create index if not exists payroll_runs_tenant on public.payroll_runs(tenant_id, month desc);
