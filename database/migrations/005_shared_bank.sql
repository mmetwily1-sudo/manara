-- ترحيل 005: البنك المركزي المشترك (أسئلة عامة لكل السناتر)
-- التنفيذ: Supabase Dashboard → SQL Editor → Run (مرة واحدة، آمن التكرار)

-- 1) السماح بصفوف عامة (tenant فارغ = ملك المنصة)
alter table questions alter column tenant_id drop not null;

-- 2) الرؤية والحالة والمرجع
alter table questions add column if not exists visibility text not null default 'private'
  check (visibility in ('private','shared'));
alter table questions add column if not exists status text not null default 'approved'
  check (status in ('draft','pending','approved','rejected'));
alter table questions add column if not exists source_detail text;
alter table questions add column if not exists reviewed_by uuid references users(id) on delete set null;
alter table questions add column if not exists reviewed_at timestamptz;

-- 3) قاعدة سلامة: العام دائماً معتمد، والخاص المعتمد افتراضياً
-- (يُدار بالمنطق في الـ API — القيد هنا للتوثيق فقط)

-- 4) فهرس البنك المشترك
create index if not exists idx_questions_shared
  on questions(visibility, status, subject, lesson_code);

-- 5) الأسئلة القديمة: خاصة ومعتمدة (لا تغيير سلوكي)
update questions set visibility = 'private', status = 'approved'
  where visibility is null or status is null;
