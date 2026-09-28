-- 055: الفعاليات (رسوم + سعة + تسجيل يولد فاتورة)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  event_at timestamptz not null,
  fee numeric not null default 0 check (fee >= 0),
  capacity int not null default -1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.event_regs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, event_id, student_id)
);
create index if not exists event_regs_tenant on public.event_regs(tenant_id, event_id);
