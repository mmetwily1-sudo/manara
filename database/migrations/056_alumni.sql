-- 056: الخريجون (سنة + إنجاز + مميز للجدار العام)
create table if not exists public.alumni (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  phone text not null default '',
  grad_year int not null default 2026,
  achievement text not null default '',
  featured boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists alumni_tenant on public.alumni(tenant_id, featured, grad_year desc);
