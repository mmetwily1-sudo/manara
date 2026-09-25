-- 021: تذكير التحصيل التلقائي (قاعدة 3 أيام + منع إزعاج)
alter table public.invoices add column if not exists last_reminded_at timestamptz;
alter table public.invoices add column if not exists reminder_count int not null default 0;
create index if not exists invoices_remind on public.invoices(tenant_id, status, last_reminded_at);
