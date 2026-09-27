-- 028: مخزون المنتجات + عقود B2B
alter table public.products add column if not exists stock_qty int not null default -1;
alter table public.products add column if not exists low_stock_at int not null default 5;

create table if not exists public.b2b_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  org_name text not null,
  contact text not null default '',
  value int not null default 0,
  start_date date,
  end_date date,
  notes text not null default '',
  status text not null default 'active' check (status in ('active','done','cancelled')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists b2b_tenant on public.b2b_contracts(tenant_id, status);
