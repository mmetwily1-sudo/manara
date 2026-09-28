-- 046: عقود الموظفين (راتب أساسي + نوع + فترة + نشط)
create table if not exists public.staff_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  salary_base numeric not null default 0 check (salary_base >= 0),
  kind text not null default 'monthly' check (kind in ('monthly', 'per_session', 'commission')),
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id, active)
);
create index if not exists staff_contracts_tenant on public.staff_contracts(tenant_id, active);
