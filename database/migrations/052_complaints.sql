-- 052: الشكاوى والمقترحات (رد المعلم + حالة)
create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid references public.users(id) on delete set null,
  kind text not null default 'complaint' check (kind in ('complaint', 'suggestion')),
  body text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  reply text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists complaints_tenant on public.complaints(tenant_id, status, created_at desc);
