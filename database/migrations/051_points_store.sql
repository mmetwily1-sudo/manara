-- 051: متجر النقاط (مكافآت + استبدال من رصيد الطالب)
create table if not exists public.point_rewards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  cost_points int not null check (cost_points > 0),
  stock int not null default -1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.point_redemptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  reward_id uuid not null references public.point_rewards(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'delivered')),
  created_at timestamptz not null default now()
);
create index if not exists point_redemptions_tenant on public.point_redemptions(tenant_id, status);
