-- 076: غرفة اللايف (مزود + رابط خارجي + رفع يد)
alter table public.live_sessions add column if not exists provider text not null default 'jitsi' check (provider in ('jitsi', 'zoom', 'link'));
alter table public.live_sessions add column if not exists ext_url text not null default '';
create table if not exists public.live_hands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);
create index if not exists live_hands_session on public.live_hands(session_id, created_at);
