-- 044: بوابة ولي الأمر المحسنة + دفع أونلاين
create table if not exists public.parent_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_id uuid not null references public.users(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists pps_token on public.parent_portal_sessions(token_hash);

-- إعدادات الدفع عبر الإنترنت
alter table public.tenants add column if not exists online_payment_enabled boolean not null default false;
alter table public.tenants add column if not exists paymob_webhook_url text;