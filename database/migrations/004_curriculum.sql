-- ترحيل 004: طبقة المنهج المرجعية (وزارة/أزهر/كتب خارجية)
-- التنفيذ: الصق في Supabase Dashboard → SQL Editor → Run (مرة واحدة، آمن التكرار)

-- 1) المسارات الدراسية: عام / أزهري × صف × ترم
create table if not exists curriculum_tracks (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,          -- moe-g3-sec-sci : moe | azhar - grade - term - stream
  system text not null check (system in ('moe','azhar')),
  grade text not null,                -- 3sec | 3prep | ...
  grade_ar text not null,             -- الثالث الثانوي | الثالث الإعدادي ...
  stream text,                        -- sci | math | lit (للثانوي)
  stream_ar text,                     -- علمي علوم | علمي رياضة | أدبي
  term int not null default 1 check (term in (1,2)),
  year int not null default 2026,     -- سنة المنهج
  is_active boolean not null default true
);

-- 2) مفردات المنهج: مادة ← وحدة ← درس (مع وزن امتحاني استرشادي %)
create table if not exists curriculum_lessons (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references curriculum_tracks(id) on delete cascade,
  subject text not null,              -- فيزياء
  unit_no int not null,               -- 1
  unit_title text not null,           -- الكهربية التيارية
  lesson_no int not null,             -- 1
  lesson_title text not null,         -- التيار الكهربي وقانون أوم
  code text not null,                 -- phys-u1-l1 (يربط سؤال البنك بالدرس)
  weight int not null default 10,     -- الوزن الامتحاني % داخل المادة
  unique(track_id, code)
);
create index if not exists idx_curr_lessons_track on curriculum_lessons(track_id, subject);

-- 3) الكتب الخارجية المرتبطة بكل مسار/مادة
create table if not exists curriculum_books (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references curriculum_tracks(id) on delete cascade,
  subject text not null,
  name text not null,                 -- الامتحان | المعاصر | كيان | البرهان ...
  unique(track_id, subject, name)
);

-- 4) ربط أسئلة البنك بالدرس والكتاب المصدر
alter table questions add column if not exists lesson_code text;
alter table questions add column if not exists book_id uuid references curriculum_books(id) on delete set null;
alter table questions add column if not exists source text check (source in ('teacher','book','moe','azhar') );
create index if not exists idx_questions_lesson on questions(tenant_id, lesson_code);
create index if not exists idx_questions_subject on questions(tenant_id, subject);

-- 5) توثيق سياق المنهج على الامتحان المولّد
alter table exams add column if not exists track_id uuid references curriculum_tracks(id) on delete set null;
alter table exams add column if not exists subject text;
alter table exams add column if not exists coverage jsonb not null default '{}';

-- 6) عدّاد استخدام الأسئلة (إشارة جودة للتوليد المستقبلي) — استدعاء واحد
create or replace function bump_questions_usage(qids uuid[])
returns void language sql security definer as $$
  update questions set usage_count = usage_count + 1 where id = any(qids);
$$;
