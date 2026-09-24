-- 011: أكواد دخول الامتحانات (مكافحة الغش — جلسة واحدة + مؤقت سيرفر)
-- مبني على إجماع لجنة الـAI (الجولة 2): كود قصير + Session Lock + إعادة دخول بنفس الجهاز + hash فقط
create table if not exists public.exam_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid references public.users(id) on delete cascade,
  code_hash text not null,
  code_hint text not null default '',
  status text not null default 'issued' check (status in ('issued','started','submitted','expired','revoked')),
  device_fp text,
  ip text,
  issued_at timestamptz not null default now(),
  started_at timestamptz,
  expires_at timestamptz,
  submitted_at timestamptz,
  created_by uuid
);
create unique index if not exists exam_codes_tenant_hash on public.exam_codes(tenant_id, code_hash);
-- جلسة نشطة واحدة لكل (امتحان × طالب): يمنع المشاركة المتزامنة (partial index)
create unique index if not exists exam_codes_active_student
  on public.exam_codes(exam_id, student_id)
  where status in ('issued','started') and student_id is not null;
create index if not exists exam_codes_exam on public.exam_codes(exam_id);
create index if not exists exam_codes_tenant on public.exam_codes(tenant_id);

-- تفعيل الكود إجبارياً لكل امتحان (opt-in — المعلم يفعّل تدريجياً)
alter table public.exams add column if not exists require_code boolean not null default false;
