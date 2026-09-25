-- 016: الفواتير الدورية (اشتراك شهري لكل تسجيل نشط) + عدّاد إيصالات متسلسل
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  period text not null, -- YYYY-MM
  amount numeric not null default 0,
  paid numeric not null default 0,
  status text not null default 'unpaid' check (status in ('unpaid','partial','paid','overdue')),
  receipt_no int,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create unique index if not exists invoices_one_per_period
  on public.invoices(tenant_id, student_id, group_id, period);
create index if not exists invoices_tenant_status on public.invoices(tenant_id, status, period);
create index if not exists invoices_student on public.invoices(student_id);

-- عدّاد تسلسلي لكل سنتر (أرقام إيصالات بلا فجوات سباق)
create table if not exists public.tenant_counters (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  receipt_seq int not null default 0
);

-- رقم إيصال على كل دفعة
alter table public.payments add column if not exists receipt_no int;
alter table public.payments add column if not exists invoice_id uuid references public.invoices(id) on delete set null;
