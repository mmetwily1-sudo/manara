-- 039: إجازات رسمية + بديل الحصة + تقييم الحصص
create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  holiday_date date not null,
  title text not null default '',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, holiday_date)
);
create index if not exists holidays_tenant on public.holidays(tenant_id, holiday_date);

alter table public.sessions add column if not exists substitute_id uuid references public.users(id) on delete set null;

create table if not exists public.session_ratings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  score int not null check (score >= 1 and score <= 5),
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);
create index if not exists ratings_session on public.session_ratings(session_id);
