-- 071: صفحات السنتر المخصصة (منشور/مسودة + رابط عام)
create table if not exists public.tenant_pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  title text not null,
  body text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index if not exists tenant_pages_tenant on public.tenant_pages(tenant_id, published);
