-- 045: المذكرات والمحتوى التعليمي
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  title text not null,
  subject text not null default '',
  lesson text not null default '',
  content text not null default '',
  visibility text not null default 'group' check (visibility in ('public','group','private')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_tenant on public.notes(tenant_id, visibility);
create index if not exists notes_group on public.notes(group_id);