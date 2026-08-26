-- ============================================================
-- منارة — Database Schema (PostgreSQL / Supabase)
-- معمارية Multi-Tenant: Shared DB + tenant_id + Row Level Security
-- المرجع: skill multi-tenant-lms-architecture
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- 1. TENANTS (المعلمون والسناتر)
-- ============================================================
create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,              -- ahmed.manara.app
  custom_domain text unique,              -- دومين مخصص اختياري
  name text not null,                     -- "سنتر النور" أو "أ. أحمد محمد"
  owner_user_id uuid,                     -- يتحدث بعد إنشاء المستخدم
  primary_color varchar(7) default '#1A73E8',
  logo_url text,
  plan text not null default 'trial'
    check (plan in ('trial','basic','pro','center_plus','enterprise')),
  trial_ends_at timestamptz,
  status text not null default 'active'
    check (status in ('active','past_due','suspended','archived')),
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. USERS والأدوار
-- roles: teacher_admin | secretary | student | parent | platform_admin
-- ============================================================
create table users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,               -- ربط Supabase Auth (nullable للمعاينات)
  tenant_id uuid references tenants(id) on delete cascade,
  role text not null check (role in ('teacher_admin','secretary','student','parent','platform_admin')),
  full_name text not null,
  phone varchar(20) unique,               -- الهوية الأساسية في مصر
  phone_verified_at timestamptz,
  avatar_url text,
  points integer not null default 0,      -- gamification
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_users_tenant on users(tenant_id);
create index idx_users_phone on users(phone);

alter table tenants add constraint fk_owner
  foreign key (owner_user_id) references users(id);

-- ============================================================
-- 3. المجموعات والجدول والتسجيل
-- ============================================================
create table groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  teacher_id uuid references users(id),
  name text not null,                     -- "ثانوية عامة - السبت"
  grade_level text,
  subject text,
  monthly_fee numeric(10,2) default 0,
  schedule jsonb not null default '[]',   -- [{weekday:6,start:'16:00',end:'18:00',room:'A'}]
  created_at timestamptz not null default now()
);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  special_price numeric(10,2),            -- سعر خاص لطالب معين (نمط حاضر)
  status text not null default 'active' check (status in ('active','paused','left')),
  joined_at timestamptz not null default now(),
  unique(student_id, group_id)
);

-- ============================================================
-- 4. الحضور والغياب (أوفلاين-أولًا عند التطبيق، سيرفر هنا هو المصدر)
-- ============================================================
create table sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  session_date date not null,
  topic text,
  status text not null default 'scheduled' check (status in ('scheduled','done','cancelled'))
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  status text not null check (status in ('present','absent','late','excused')),
  method text check (method in ('qr','manual','code','live_join')),
  recorded_by uuid references users(id),
  recorded_at timestamptz not null default now(),
  unique(session_id, student_id)
);
create index idx_attendance_student_date on attendance(tenant_id, student_id, recorded_at desc);

-- ============================================================
-- 5. بنك الأسئلة والامتحانات (مع دعم LaTeX للرياضة)
-- ============================================================
create table questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  subject text,
  lesson text,
  difficulty smallint not null default 2 check (difficulty between 1 and 5),
  qtype text not null check (qtype in ('mcq','true_false','short_answer','essay','code')),
  body text not null,                     -- يدعم $LaTeX$
  media_url text,
  options jsonb,                          -- ["نص", ...] للـ mcq
  correct_answer jsonb,
  marks numeric(5,2) not null default 1,
  usage_count int not null default 0,
  created_at timestamptz not null default now()
);

create table exams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  group_id uuid references groups(id),
  title text not null,
  duration_minutes int not null default 30,
  total_marks numeric(6,2) not null default 0,
  variant_seed text,                      -- نسخ A/B/C عشوائية
  is_published boolean not null default false,
  available_from timestamptz,
  available_to timestamptz,
  created_at timestamptz not null default now()
);

create table exam_questions (
  exam_id uuid references exams(id) on delete cascade,
  question_id uuid references questions(id),
  tenant_id uuid not null references tenants(id) on delete cascade,
  position smallint,
  marks numeric(5,2),
  primary key (exam_id, question_id)
);

create table exam_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  exam_id uuid not null references exams(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  answers jsonb not null default '{}',    -- autosave draft + نهائي
  score numeric(6,2),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  tab_switches smallint default 0,        -- مراقبة الغش
  unique(exam_id, student_id)
);

-- ============================================================
-- 6. الفيديوهات والكورسات (Bunny Stream)
-- ============================================================
create table videos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  provider_video_id text,                 -- Bunny video library id
  visibility text not null default 'group'
    check (visibility in ('free','paid','group')),
  group_ids jsonb not null default '[]',
  excluded_student_ids jsonb not null default '[]',
  duration_sec int,
  watch_progress jsonb not null default '{}',  -- {studentId: seconds}
  available_from timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 7. الواجبات
-- ============================================================
create table assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz,
  max_score numeric(5,2) default 10,
  allow_late boolean default true,
  created_at timestamptz not null default now()
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  file_urls jsonb not null default '[]',
  score numeric(5,2),
  feedback_text text,
  voice_feedback_url text,
  status text not null default 'submitted' check (status in ('submitted','graded','returned','late')),
  submitted_at timestamptz not null default now(),
  unique(assignment_id, student_id)
);

-- ============================================================
-- 8. المالية (كاش أولًا — أي عملية فلوس لازم سيرفر يوثقها)
-- ============================================================
create table payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  student_id uuid not null references users(id),
  group_id uuid references groups(id),
  amount numeric(10,2) not null,
  method text not null default 'cash'
    check (method in ('cash','wallet','instapay','card','fawry')),
  status text not null default 'confirmed' check (status in ('pending','confirmed','rejected')),
  confirmed_by uuid references users(id),
  receipt_image_url text,                 -- إيصال التحويل من ولي الأمر
  note text,
  paid_at timestamptz not null default now(),
  voided_at timestamptz                   -- تراجع موثق لا حذف
);
create index idx_payments_tenant_date on payments(tenant_id, paid_at desc);

create table billing_cycles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  group_id uuid not null references groups(id),
  period_month date not null,             -- أول الشهر
  due_day smallint default 5,
  amount numeric(10,2) not null
);

-- ============================================================
-- 9. الرسائل والمنتدى (channels لكل مجموعة)
-- ============================================================
create table threads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  ttype text not null check (ttype in ('group_forum','direct','announcement'))
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  thread_id uuid not null references threads(id) on delete cascade,
  sender_id uuid not null references users(id),
  mtype text not null default 'text' check (mtype in ('text','voice','file','image')),
  body text,
  media_url text,
  duration_sec int,
  reply_to_id uuid references messages(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_messages_thread on messages(thread_id, created_at desc);

create table message_reads (
  tenant_id uuid not null references tenants(id) on delete cascade,
  message_id uuid references messages(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- ============================================================
-- 10. الشهادات (QR verification عام)
-- ============================================================
create table certificates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  student_id uuid not null references users(id),
  attempt_id uuid references exam_attempts(id),
  title text not null,
  score numeric(6,2),
  serial_code text unique not null default ('MNR-' || to_char(now(),'YYYY') || '-' || lpad(floor(random()*1000000)::text, 6, '0')),
  pdf_url text,
  png_url text,
  issued_at timestamptz not null default now()
);

-- ============================================================
-- 11. الإشعارات (Push أولاً + Telegram + WhatsApp manual)
-- ============================================================
create table notification_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  user_id uuid not null references users(id),
  event text not null,                    -- attendance_absent / payment_received / exam_graded...
  channel text not null check (channel in ('push','telegram','whatsapp_manual','sms','inapp')),
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued','sent','failed','read')),
  dedupe_key text unique,                 -- idempotency: مفيش رسالة مرتين
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notif_dedupe on notification_log(dedupe_key);

-- ============================================================
-- 12. اشتراكات المنصة نفسها (SaaS Billing — Super Admin)
-- ============================================================
create table platform_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  plan text not null,
  amount numeric(10,2) not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open','paid','void')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete set null,
  opened_by uuid references users(id),
  category text not null default 'question',   -- bug/question/feature/billing
  subject text not null,
  body text,
  priority text not null default 'normal',
  status text not null default 'open' check (status in ('open','waiting','resolved')),
  first_response_at timestamptz,          -- SLA ساعتين
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table audit_log (
  id bigserial primary key,
  tenant_id uuid,
  actor_id uuid,
  action text not null,                   -- payment_voided / student_deleted / vault_closed...
  entity_type text,
  entity_id uuid,
  details jsonb not null default '{}',    -- {from: 600, to: 500}
  ip inet,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY — العزل على مستوى قاعدة البيانات
-- (النص التسويقي الحرفي: "مفيش سنتر يشوف بيانات غيره إطلاقًا")
-- ============================================================

create or replace function current_tenant_id() returns uuid
language sql stable security definer as $$
  select tenant_id from users where auth_user_id = auth.uid() limit 1;
$$;

create or replace function is_platform_admin() returns boolean
language sql stable security definer as $$
  select exists(
    select 1 from users
    where auth_user_id = auth.uid() and role = 'platform_admin'
  );
$$;

-- تفعيل RLS على كل جداول الـtenants
do $$
declare t text;
begin
  foreach t in array array[
    'users','groups','enrollments','sessions','attendance',
    'questions','exams','exam_questions','exam_attempts',
    'videos','assignments','submissions','payments','billing_cycles',
    'threads','messages','message_reads','certificates',
    'notification_log','platform_invoices','support_tickets'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format($f$
      create policy tenant_isolation on %I
      using (tenant_id = current_tenant_id() or is_platform_admin());
    $f$, t);
  end loop;
end $$;

-- audit_log: قراءة فقط لصاحب السنتر
alter table audit_log enable row level security;
create policy audit_read_own on audit_log
  for select using (tenant_id = current_tenant_id());

-- tenants: المعلم يشوف سنتره بس
alter table tenants enable row level security;
create policy tenant_self on tenants
  for select using (id = current_tenant_id() or is_platform_admin());

-- ============================================================
-- Seed تجريبي للتطوير المحلي
-- ============================================================
insert into tenants (slug, name, primary_color, plan)
values ('demo', 'سنتر النور التجريبي', '#1A73E8', 'trial')
on conflict (slug) do nothing;

insert into users (tenant_id, role, full_name, phone)
select id, 'teacher_admin', 'أ. أحمد محمد', '+201200000001'
from tenants where slug='demo'
on conflict (phone) do nothing;
