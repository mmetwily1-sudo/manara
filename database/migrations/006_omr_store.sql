-- الترحيل 006: OMR بالكاميرا + المتجر
-- التطبيق: Supabase Dashboard → SQL Editor → Run (مرة واحدة، آمن مع IF NOT EXISTS)

-- 1) أوراق OMR (نموذج إجابة لكل امتحان ورقي)
create table if not exists omr_sheets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  num_questions int not null check (num_questions between 1 and 200),
  num_choices int not null default 4 check (num_choices between 2 and 6),
  answer_key jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- 2) نتائج تصحيح OMR
create table if not exists omr_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  sheet_id uuid not null references omr_sheets(id) on delete cascade,
  student_id uuid references users(id) on delete set null,
  student_name text,
  answers jsonb not null default '[]',
  score numeric(6,2),
  total int,
  needs_review boolean not null default false,
  photo_path text,
  created_at timestamptz not null default now()
);
create index if not exists idx_omr_results_sheet on omr_results(sheet_id, created_at desc);

-- 3) منتجات المتجر (رقمية: مذكرات PDF وغيرها)
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  file_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 4) طلبات المتجر
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  confirmed_by uuid references users(id),
  created_at timestamptz not null default now()
);

-- 5) مدفوعات المنصة (اشتراكات السناتر عبر Paymob)
create table if not exists platform_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  plan text not null,
  months int not null default 1,
  amount numeric(10,2) not null,
  currency text not null default 'EGP',
  paymob_order_id text,
  txn_id text,
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  created_at timestamptz not null default now()
);
