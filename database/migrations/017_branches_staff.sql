-- 017: الفروع + طاقم بأدوار (مشرف/مساعد/محاسب) + عزل الفروع
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);
create index if not exists branches_tenant on public.branches(tenant_id);

alter table public.users add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.groups add column if not exists branch_id uuid references public.branches(id) on delete set null;
create index if not exists users_branch on public.users(branch_id);
create index if not exists groups_branch on public.groups(branch_id);
