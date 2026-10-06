-- ============================================================
-- Migration 083 — المدرّس الذكي (AI Tutor Engine)
-- يبني فوق بيانات موجودة فعلاً (exam_attempts, attendance, questions)
-- بلا أي استدعاء LLM خارجي في النسخة الأولى — توصيات إحصائية حقيقية
-- أولاً، تُستبدل لاحقاً بـAI حقيقي بمجرد توفر حجم بيانات كافٍ.
-- ============================================================

-- ملف تعريف تعلّم كل طالب — يُحدَّث دورياً (job خلفي) لا لحظياً
create table if not exists student_learning_profile (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  subject text,
  -- نقاط الضعف: مواضيع/أسئلة بمعدل خطأ أعلى من متوسط الطالب نفسه
  weak_topics jsonb not null default '[]',
  -- متوسط سرعة الحل بالثانية لكل سؤال (لرصد التباطؤ المفاجئ)
  avg_seconds_per_question numeric,
  -- اتجاه الأداء: تحسّن / ثبات / تراجع (محسوب من آخر 5 امتحانات)
  trend text check (trend in ('up','flat','down')),
  last_computed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(tenant_id, student_id, subject)
);
create index if not exists idx_slp_tenant_student on student_learning_profile(tenant_id, student_id);

-- التوصيات المولّدة لكل طالب (تُعرض في /progress وبوابة ولي الأمر)
create table if not exists student_recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('review_topic','practice_more','slow_down','celebrate_streak','at_risk_alert')),
  subject text,
  topic text,
  message text not null,
  priority smallint not null default 3, -- 1=الأعلى إلحاحاً
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_srec_tenant_student on student_recommendations(tenant_id, student_id, dismissed_at);

alter table student_learning_profile enable row level security;
create policy tenant_isolation on student_learning_profile
  using (tenant_id = current_tenant_id() or is_platform_admin());

alter table student_recommendations enable row level security;
create policy tenant_isolation on student_recommendations
  using (tenant_id = current_tenant_id() or is_platform_admin());
