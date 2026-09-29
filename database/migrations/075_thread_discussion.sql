-- 075: السماح بنوع discussion في المنتدى (الكود ينشئ به منذ r54)
alter table public.threads drop constraint if exists threads_ttype_check;
alter table public.threads add constraint threads_ttype_check
  check (ttype in ('group_forum', 'direct', 'announcement', 'discussion'));
