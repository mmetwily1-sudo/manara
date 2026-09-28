-- 066: تنبيهات الدخول الغريب (جهاز/IP جديد)
create table if not exists public.security_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  label text not null default '',
  status text not null default 'new' check (status in ('new', 'seen')),
  created_at timestamptz not null default now()
);
create index if not exists security_alerts_tenant on public.security_alerts(tenant_id, status, created_at desc);
