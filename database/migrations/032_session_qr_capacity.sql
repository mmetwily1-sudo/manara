-- 032: QR جلسة دوّار + سعة المجموعات
alter table public.sessions add column if not exists qr_secret text;
alter table public.sessions add column if not exists qr_expires_at timestamptz;
alter table public.groups add column if not exists capacity int not null default 0;
create index if not exists sessions_qr on public.sessions(id);
