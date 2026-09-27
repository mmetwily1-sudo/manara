-- 025: حجوزات تجريبية + انتظار + موافقات ولي أمر بروابط موقعة
create table if not exists public.trial_bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  phone text not null,
  group_id uuid references public.groups(id) on delete set null,
  kind text not null default 'trial' check (kind in ('trial','waitlist')),
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','done')),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists bookings_tenant on public.trial_bookings(tenant_id, status, created_at desc);

create table if not exists public.parent_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists consents_student on public.parent_consents(tenant_id, student_id, status);
