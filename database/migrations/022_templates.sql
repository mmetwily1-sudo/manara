-- 022: قوالب رسائل السنتر (واتساب/SMS/داخلي) — تجاوز افتراضات الكود
create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp','sms','internal')),
  title text not null default '',
  body text not null default '',
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);
create index if not exists templates_tenant on public.message_templates(tenant_id, channel);
