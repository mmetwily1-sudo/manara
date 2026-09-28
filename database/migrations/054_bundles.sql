-- 054: باقات المواد (حزمة بسعر + اشتراك يولد فاتورة)
create table if not exists public.bundles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  subjects text not null default '',
  price numeric not null default 0 check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.bundle_subs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bundle_id uuid not null references public.bundles(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  period text not null,
  invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, bundle_id, student_id, period)
);
create index if not exists bundle_subs_tenant on public.bundle_subs(tenant_id, period desc);
