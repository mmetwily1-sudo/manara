-- 080: دخول الطالب برقم الهاتف + PIN (طلاب المدرس بلا بريد/حساب Auth)
alter table public.users add column if not exists pin_hash text;
alter table public.users add column if not exists pin_set_at timestamptz;

create table if not exists public.student_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists student_sessions_token on public.student_sessions(token_hash);
