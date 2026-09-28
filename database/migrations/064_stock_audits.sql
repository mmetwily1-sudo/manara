-- 064: الجرد الدوري (عد فعلي + فرق + تطبيق اختياري)
create table if not exists public.stock_audits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  system_qty int not null default 0,
  counted_qty int not null,
  diff int not null default 0,
  applied boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists stock_audits_tenant on public.stock_audits(tenant_id, created_at desc);
