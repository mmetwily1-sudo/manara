-- 027: تحديات المذاكرة (سباق نقاط بمدة ومجموعة)
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  target_points int not null default 100,
  group_id uuid references public.groups(id) on delete set null,
  deadline date,
  status text not null default 'open' check (status in ('open','closed')),
  winner_id uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists challenges_tenant on public.challenges(tenant_id, status);
