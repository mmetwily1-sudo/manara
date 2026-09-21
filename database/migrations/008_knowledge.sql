-- الترحيل 008: قاعدة معرفة منارة المحلية (استقلال عن أي AI خارجي)
-- التطبيق: Supabase Dashboard → SQL Editor → Run (مرة واحدة، آمن مع IF NOT EXISTS)

-- 1) المعرفة: قرارات وزارية + تحديثات أزهر + أدلة كتب خارجية + مذكرات تدريس
create table if not exists edu_knowledge (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ministry_decree','azhar_update','book_guide','teaching_guide','curriculum_note','exam_tip')),
  system text not null default 'moe' check (system in ('moe','azhar','general')),
  title text not null,
  body text not null,
  source_url text,
  effective_date date,
  created_at timestamptz not null default now()
);
create index if not exists idx_edu_knowledge_kind on edu_knowledge(kind, system);
create index if not exists idx_edu_knowledge_search on edu_knowledge using gin (
  to_tsvector('arabic', title || ' ' || body)
);

-- 2) كتالوج الكتب الخارجية (تغطية المواد والصفوف + ملاحظات المعلمين)
create table if not exists external_books (
  id uuid primary key default gen_random_uuid(),
  publisher text not null,
  subject text not null,
  grade text not null,
  system text not null default 'moe' check (system in ('moe','azhar')),
  edition_year text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ext_books_lookup on external_books(subject, grade, system);
