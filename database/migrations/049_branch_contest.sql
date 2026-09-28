-- 049: تنافس الفروع (نقاط شهرية + سبب)
create table if not exists public.branch_points (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  month text not null,
  points int not null default 0,
  reason text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists branch_points_tenant on public.branch_points(tenant_id, month desc);
