-- 087: سجل أحداث حالات التجديد (تدقيق منفصل عن platform_payments —
-- تلك مدفوعات فعلية، وهذا سجل انتقالات حالة). RLS من لحظة الإنشاء (قاعدة
-- ما بعد 082/086: لا جدول جديد بلا RLS).
create table if not exists public.tenant_renewal_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  from_state text not null,
  to_state text not null,
  trigger text not null default 'cron',
  created_at timestamptz not null default now()
);
create index if not exists renewal_events_tenant on public.tenant_renewal_events(tenant_id, created_at desc);

do $$
declare already_enabled boolean;
begin
  select relrowsecurity from pg_class where relname = 'tenant_renewal_events' and relnamespace = 'public'::regnamespace into already_enabled;
  if not already_enabled then
    execute 'alter table public.tenant_renewal_events enable row level security;';
  end if;
  execute 'drop policy if exists tenant_isolation on public.tenant_renewal_events;';
  execute 'create policy tenant_isolation on public.tenant_renewal_events using (tenant_id = current_tenant_id() or is_platform_admin()) with check (tenant_id = current_tenant_id() or is_platform_admin());';
  raise notice 'RLS مطبق على tenant_renewal_events';
end $$;
