-- 057: المكتبة المدفوعة (محتوى رقمي + شراء يولد فاتورة ويفتح المحتوى)
create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  subject text not null default '',
  price numeric not null default 0 check (price >= 0),
  content text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.library_purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  item_id uuid not null references public.library_items(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, item_id, student_id)
);
create index if not exists library_purchases_tenant on public.library_purchases(tenant_id, student_id);
