-- 048: تقييم أداء المعلمين الشهري (درجة + ملاحظة)
create table if not exists public.teacher_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  month text not null,
  score int not null check (score between 1 and 5),
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id, month)
);
create index if not exists teacher_reviews_tenant on public.teacher_reviews(tenant_id, month desc);
