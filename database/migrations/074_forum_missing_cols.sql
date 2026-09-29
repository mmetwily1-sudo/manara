-- 074: أعمدة المنتدى الناقصة (مثبت + فئة + تاريخ — سقطت سهواً من 041)
alter table public.threads add column if not exists pinned boolean not null default false;
alter table public.threads add column if not exists category text not null default 'general';
alter table public.threads add column if not exists created_at timestamptz not null default now();
create index if not exists threads_pinned on public.threads(tenant_id, pinned, created_at desc);
