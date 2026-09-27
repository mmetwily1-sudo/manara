-- 036: طلبات الاسترداد بموافقة المالك + ملاحظة الفاتورة (للتقسيط)
alter table public.invoices add column if not exists note text not null default '';
create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  amount int not null,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by uuid references public.users(id) on delete set null,
  decided_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (payment_id)
);
create index if not exists refunds_tenant on public.refunds(tenant_id, status);
