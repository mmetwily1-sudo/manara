-- 059: شحن المحافظات (طلب + رسوم + تتبع حالة)
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  governorate text not null default '',
  address text not null default '',
  items text not null default '',
  fee numeric not null default 0 check (fee >= 0),
  status text not null default 'pending' check (status in ('pending', 'shipped', 'delivered')),
  invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists shipments_tenant on public.shipments(tenant_id, status, created_at desc);
