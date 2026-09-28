-- 043: مفتاح تصحيح ذاتي للواجب النصي + نص الإجابة
alter table public.assignments add column if not exists answer_key text not null default '';
alter table public.submissions add column if not exists answer_text text;
