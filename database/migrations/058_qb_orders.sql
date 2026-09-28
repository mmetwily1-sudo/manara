-- 058: بيع بنك الأسئلة B2B (طلب مدرسة + تفعيل حتى تاريخ)
create table if not exists public.qb_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  school_name text not null,
  contact text not null default '',
  subject text not null default '',
  price numeric not null default 0 check (price >= 0),
  status text not null default 'pending' check (status in ('pending', 'active', 'expired')),
  access_until date,
  created_at timestamptz not null default now()
);
create index if not exists qb_orders_tenant on public.qb_orders(tenant_id, status);
