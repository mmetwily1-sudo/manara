-- ============================================================
-- Migration 082 — تفعيل RLS على باقي الجداول (85 جدولاً)
-- يكمل نمط database/schema.sql (نفس current_tenant_id() + is_platform_admin()
-- ونفس اسم الـpolicy: tenant_isolation) على كل الجداول التي أضافتها
-- migrations 003-081 ولم تُغطَّ بـRLS من قبل.
--
-- آمن للتشغيل بإعادة المحاولة (idempotent): يتخطى أي جدول عليه RLS بالفعل،
-- ويتخطى أي جدول بلا عمود tenant_id (يُطبع تحذيراً بدل الفشل).
-- ============================================================

do $$
declare
  t text;
  has_tenant_col boolean;
  already_enabled boolean;
  tables text[] := array[
    'absence_excuses','agent_messages','agent_threads','alumni','api_keys',
    'b2b_contracts','bank_statements','behavior_notes','bg_jobs','branch_points',
    'branches','bundle_subs','bundles','cash_audits','challenges','complaints',
    'coupons','dm_threads','event_regs','events','exam_codes','exam_templates',
    'expenses','feedback','holidays','invoices','leave_requests','library_items',
    'library_purchases','live_attendance','live_hands','live_sessions',
    'login_devices','message_templates','notes','omr_results','omr_sheets',
    'orders','otp_codes','outgoing_webhooks','owner_secrets','parent_consents',
    'parent_digests','parent_portal_sessions','payroll_items','payroll_runs',
    'platform_payments','point_redemptions','point_rewards','products','projects',
    'push_subscriptions','qb_orders','referrals','refunds','route_subs',
    'scholarships','security_alerts','session_ratings','shipments','sms_queue',
    'staff_advances','staff_contracts','staff_presence','staff_tasks',
    'stock_audits','student_goals','student_sessions','teacher_reviews',
    'telegram_links','tenant_counters','tenant_features','tenant_pages',
    'transport_routes','trial_bookings','vehicles','wa_usage','webhook_deliveries'
    -- ملاحظة: curriculum_books / curriculum_lessons / curriculum_tracks /
    -- edu_knowledge / external_books / knowledge_gaps / platform_settings
    -- مُستبعدة عمداً — لا تحتوي عمود tenant_id (محتوى مشترك/إعدادات منصة).
    -- راجعها يدوياً في القسم الثاني من هذا الملف.
  ];
begin
  foreach t in array tables loop
    -- تحقق: الجدول موجود أصلاً؟ (دفاع إضافي لو migration سابقة اتغيرت)
    if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      raise notice 'تخطّي % — الجدول غير موجود', t;
      continue;
    end if;

    -- تحقق: عنده عمود tenant_id؟
    select exists(
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'tenant_id'
    ) into has_tenant_col;

    if not has_tenant_col then
      raise notice 'تخطّي % — بلا عمود tenant_id (يحتاج قرار يدوي)', t;
      continue;
    end if;

    -- تحقق: policy tenant_isolation موجودة بالفعل؟ (المعيار الصحيح —
    -- RLS قد تكون مفعّلة بلا أي policy وهذا رفض كامل بلا عزل حقيقي)
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = 'tenant_isolation'
    ) then
      raise notice 'تخطّي % — policy موجودة بالفعل', t;
      continue;
    end if;

    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists tenant_isolation on %I;', t);
    execute format($f$
      create policy tenant_isolation on %I
      using (tenant_id = current_tenant_id() or is_platform_admin());
    $f$, t);
    raise notice 'تم تفعيل RLS على %', t;
  end loop;
end $$;

-- ============================================================
-- جداول بلا tenant_id — محتاجة قرار يدوي (لا تُطبَّق عليها tenant_isolation تلقائياً)
-- شغّل الاستعلام ده للتأكد من قائمتها الحالية فعلياً في قاعدة بياناتك:
-- ============================================================
-- select table_name from information_schema.tables t
-- where table_schema = 'public' and table_type = 'BASE TABLE'
--   and not exists (
--     select 1 from information_schema.columns c
--     where c.table_schema = 'public' and c.table_name = t.table_name and c.column_name = 'tenant_id'
--   )
-- order by table_name;
--
-- المعروفة حالياً (محتوى منهج/معرفة مشترك + إعدادات منصة):
--   curriculum_books, curriculum_lessons, curriculum_tracks,
--   edu_knowledge, external_books, knowledge_gaps, platform_settings
--
-- التوصية لكل نوع:
-- 1) محتوى منهج مشترك (curriculum_*, external_books, edu_knowledge, knowledge_gaps):
--    RLS بسياسة "قراءة للجميع، كتابة لـplatform_admin فقط" — مثال:
--
--    alter table curriculum_tracks enable row level security;
--    create policy curriculum_read_all on curriculum_tracks for select using (true);
--    create policy curriculum_write_admin on curriculum_tracks for all
--      using (is_platform_admin()) with check (is_platform_admin());
--
--    (كرّر نفس النمط على curriculum_books, curriculum_lessons, external_books,
--     edu_knowledge, knowledge_gaps — راجع كل جدول: هل فعلاً عام أم يفترض أن
--     يكون لكل سنتر محتواه الخاص؟ لو الأخير، أضف عمود tenant_id بدل ده.)
--
-- 2) platform_settings: إعدادات المنصة نفسها (لا علاقة لها بـtenant معين) —
--    يجب أن تكون مقفولة بالكامل لـplatform_admin فقط:
--
--    alter table platform_settings enable row level security;
--    create policy platform_settings_admin_only on platform_settings for all
--      using (is_platform_admin()) with check (is_platform_admin());

-- ============================================================
-- التحقق بعد التشغيل
-- ============================================================
-- عدد الجداول التي لسه بلا RLS في public schema (المفروض يقترب من صفر،
-- عدا الجداول المشتركة المذكورة فوق لحد ما تُحسم يدوياً):
--
-- select c.relname as table_name
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
-- order by c.relname;
