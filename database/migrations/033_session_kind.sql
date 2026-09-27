-- 033: نوع الحصة (عادية/تعويضية/ملغاة)
alter table public.sessions add column if not exists kind text not null default 'regular' check (kind in ('regular','makeup','cancelled'));
