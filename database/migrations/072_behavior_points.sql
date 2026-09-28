-- 072: نقاط السلوك (تطبق تلقائياً على رصيد الطالب)
alter table public.behavior_notes add column if not exists points int not null default 0;
