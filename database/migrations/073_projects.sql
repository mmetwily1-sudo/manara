-- 073: مشاريع الطلاب (تقديم + اعتماد + تمييز للعرض)
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  link text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  featured boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists projects_tenant on public.projects(tenant_id, status, featured);
