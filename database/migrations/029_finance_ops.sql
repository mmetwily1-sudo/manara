-- 029: مصروفات تشغيلية + جرد خزنة بعجز/فائض وموافقة
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  amount int not null check (amount > 0),
  category text not null default 'general',
  spent_at date not null default CURRENT_DATE,
  note text not null default '',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists expenses_tenant on public.expenses(tenant_id, spent_at desc);

create table if not exists public.cash_audits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  audit_date date not null default CURRENT_DATE,
  expected int not null,
  actual int not null,
  note text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by uuid references public.users(id) on delete set null,
  decided_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists audits_tenant on public.cash_audits(tenant_id, audit_date desc);
