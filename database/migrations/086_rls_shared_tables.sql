-- ============================================================
-- Migration 086 — إغلاق فجوة RLS المتبقية فعلياً (لا تعليقاً هذه المرة)
-- migration 082 استثنى 7 جداول عمداً (بلا tenant_id) وترك توصية كـSQL
-- معلّق بـ-- لمراجعة يدوية. رُوجعت الآن وتُطبَّق فعلياً:
--
-- - منهج/معرفة مشتركة (قراءة عامة لأي معلم، كتابة لـplatform_admin فقط):
--   curriculum_books, curriculum_lessons, curriculum_tracks,
--   edu_knowledge, external_books, knowledge_gaps
-- - إعدادات المنصة (مقفولة بالكامل على platform_admin):
--   platform_settings
--
-- آمن لإعادة التشغيل: يتخطى أي جدول عليه RLS بالفعل أو غير موجود.
-- ============================================================

do $$
declare
  t text;
  already_enabled boolean;
  shared_read_tables text[] := array[
    'curriculum_books','curriculum_lessons','curriculum_tracks',
    'edu_knowledge','external_books','knowledge_gaps'
  ];
begin
  foreach t in array shared_read_tables loop
    if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      raise notice 'تخطّي % — الجدول غير موجود', t;
      continue;
    end if;
    select relrowsecurity from pg_class where relname = t and relnamespace = 'public'::regnamespace into already_enabled;
    if already_enabled then
      raise notice 'تخطّي % — RLS مفعّل بالفعل', t;
      continue;
    end if;
    execute format('alter table %I enable row level security;', t);
    execute format('create policy %I_read_all on %I for select using (true);', t, t);
    execute format(
      'create policy %I_write_admin on %I for all using (is_platform_admin()) with check (is_platform_admin());',
      t, t
    );
    raise notice 'تم تفعيل RLS (قراءة عامة + كتابة admin) على %', t;
  end loop;
end $$;

-- platform_settings: مقفول بالكامل — لا قراءة عامة حتى (يُقرأ عبر service_role في API فقط)
do $$
declare already_enabled boolean;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'platform_settings') then
    select relrowsecurity from pg_class where relname = 'platform_settings' and relnamespace = 'public'::regnamespace into already_enabled;
    if not already_enabled then
      execute 'alter table platform_settings enable row level security;';
      execute 'create policy platform_settings_admin_only on platform_settings for all using (is_platform_admin()) with check (is_platform_admin());';
      raise notice 'تم تفعيل RLS (admin فقط) على platform_settings';
    else
      raise notice 'تخطّي platform_settings — RLS مفعّل بالفعل';
    end if;
  else
    raise notice 'تخطّي platform_settings — الجدول غير موجود';
  end if;
end $$;

-- ============================================================
-- التحقق: بعد تشغيل هذا الملف + 082، يجب ألا يظهر أي جدول هنا إطلاقاً
-- ============================================================
-- select c.relname as table_name
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
-- order by c.relname;
