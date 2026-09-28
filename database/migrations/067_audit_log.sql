-- 067: سجل التدقيق المركزي (كان يُكتب بتجاهل الأخطاء — الآن جدول حقيقي)
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  action text not null default '',
  entity_type text not null default '',
  entity_id text not null default '',
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists audit_log_tenant on public.audit_log(tenant_id, created_at desc);
create index if not exists audit_log_action on public.audit_log(tenant_id, action);
