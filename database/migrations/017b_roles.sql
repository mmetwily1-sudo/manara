-- 017b: فتح أدوار الطاقم (مشرف/مساعد/محاسب) — كانت محصورة بقيد قديم
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
  check (role = any (array['teacher_admin','supervisor','assistant','accountant','secretary','student','parent','platform_admin']));
