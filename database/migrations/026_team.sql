-- 026: مهام الطاقم + طلبات إجازة
create table if not exists public.staff_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  assignee_id uuid references public.users(id) on delete set null,
  due_date date,
  status text not null default 'open' check (status in ('open','done','cancelled')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists tasks_tenant on public.staff_tasks(tenant_id, status);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  from_date date not null,
  to_date date not null,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists leaves_tenant on public.leave_requests(tenant_id, status);
