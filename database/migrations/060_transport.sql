-- 060: أسطول المواصلات (عربيات + خطوط سير + اشتراك يولد فاتورة)
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plate text not null default '',
  capacity int not null default 0,
  driver text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.transport_routes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  stops text not null default '',
  fee numeric not null default 0 check (fee >= 0),
  vehicle_id uuid references public.vehicles(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.route_subs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  route_id uuid not null references public.transport_routes(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  period text not null,
  invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, route_id, student_id, period)
);
