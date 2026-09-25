-- 018: تقارير أولياء الأمور الدورية (أسبوعية) — push + مشاركة واتساب بضغطة
create table if not exists public.parent_digests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  period text not null, -- YYYY-MM-DD بداية الأسبوع
  payload jsonb not null default '{}',
  wa_text text not null default '',
  created_at timestamptz not null default now()
);
create unique index if not exists digests_one_per_week
  on public.parent_digests(tenant_id, student_id, period);
create index if not exists digests_tenant on public.parent_digests(tenant_id, created_at desc);
