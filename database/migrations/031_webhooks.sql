-- 031: ويبهوكات صادرة (تكامل الأنظمة الخارجية) + سجل تسليم
create table if not exists public.outgoing_webhooks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  url text not null,
  events text[] not null default '{payment_received}',
  secret text not null default '',
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists webhooks_tenant on public.outgoing_webhooks(tenant_id, is_active);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  webhook_id uuid not null references public.outgoing_webhooks(id) on delete cascade,
  event text not null,
  status_code int,
  ok boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists deliveries_hook on public.webhook_deliveries(webhook_id, created_at desc);
