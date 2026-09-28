-- 050: سلف الموظفين (تخصم تلقائياً من المسير القادم)
create table if not exists public.staff_advances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  amount numeric not null check (amount > 0),
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'deducted')),
  created_at timestamptz not null default now()
);
create index if not exists staff_advances_tenant on public.staff_advances(tenant_id, status);
