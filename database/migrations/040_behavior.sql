-- 040: سجل السلوك + إيقاف مؤقت
create table if not exists public.behavior_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  kind text not null default 'negative' check (kind in ('positive','negative')),
  text text not null default '',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists behavior_student on public.behavior_notes(tenant_id, student_id);

alter table public.users add column if not exists suspended_until date;
