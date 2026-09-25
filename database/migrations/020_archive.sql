-- 020: أرشفة الامتحانات القديمة (تنظيم + أداء القوائم)
alter table public.exams add column if not exists is_archived boolean not null default false;
alter table public.exams add column if not exists archived_at timestamptz;
create index if not exists exams_tenant_archived on public.exams(tenant_id, is_archived, created_at desc);
