-- 034: حضور الموظفين (دخول/خروج يومي)
create table if not exists public.staff_presence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  work_date date not null default CURRENT_DATE,
  check_in timestamptz,
  check_out timestamptz,
  unique (tenant_id, user_id, work_date)
);
create index if not exists presence_tenant on public.staff_presence(tenant_id, work_date desc);
