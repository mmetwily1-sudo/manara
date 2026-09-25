-- 015: صوت المعلم (NPS + اقتراحات + بلاغات) — حلقة النمو
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  kind text not null default 'idea' check (kind in ('nps','idea','bug','praise')),
  score int check (score is null or (score >= 1 and score <= 10)),
  text text not null default '',
  page text,
  created_at timestamptz not null default now()
);
create index if not exists feedback_tenant on public.feedback(tenant_id, created_at desc);
create index if not exists feedback_kind on public.feedback(kind);
