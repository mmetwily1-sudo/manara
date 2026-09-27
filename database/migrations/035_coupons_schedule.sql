-- 035: كوبونات خصم + جدولة الإعلانات
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  pct int not null check (pct > 0 and pct <= 90),
  max_uses int not null default 100,
  used int not null default 0,
  expires_at date,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);
create index if not exists coupons_tenant on public.coupons(tenant_id, is_active);

alter table public.threads add column if not exists publish_at timestamptz;
create index if not exists threads_publish on public.threads(tenant_id, ttype, publish_at);
