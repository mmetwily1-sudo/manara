-- ============================================================
-- Migration 085 — محرك التنبؤ الوطني (Network Effect الإحصائي)
-- جدول مُجمَّع بالكامل: لا tenant_id ولا student_id فيه إطلاقاً —
-- أرقام إحصائية مجمّعة عبر كل المنصة فقط (subject/lesson/difficulty).
-- هذا تصميم متعمد: الجدول نفسه لا يحتاج RLS لأنه لا يحتوي بيانات
-- تخص tenant بعينه، وآمن للعرض لأي معلم كأداة استرشادية لتخطيط المنهج.
-- ============================================================

create table if not exists question_national_stats (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  lesson text not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  sample_size integer not null default 0,      -- عدد محاولات الإجابة المجمّعة
  avg_error_rate numeric(5,4),                 -- 0.00 - 1.00
  avg_seconds_per_question numeric,
  contributing_tenants integer not null default 0, -- كم سنتر ساهم (شفافية، لا هوية)
  updated_at timestamptz not null default now(),
  unique(subject, lesson, difficulty)
);
create index if not exists idx_qns_subject_lesson on question_national_stats(subject, lesson);

-- لا RLS هنا عمداً — الجدول مُجمَّع إحصائياً بلا أي معرّف tenant أو طالب.
comment on table question_national_stats is
  'مُجمَّع إحصائياً بالكامل — لا tenant_id/student_id — بلا RLS عمداً';
