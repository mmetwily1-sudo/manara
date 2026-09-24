-- 012: برنامج الإحالة (المعلم يرشح زميلاً → مكافأة بعد أول دفعة + فترة حماية)
-- قواعد اللجنة: لا مكافأة عند التسجيل، سقف شهري/سنوي، منع ذاتي، استحقاق واحد لكل مُحال
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  referee_tenant_id uuid references public.tenants(id) on delete set null,
  referee_phone_hash text,
  status text not null default 'pending' check (status in ('pending','qualified','rewarded','revoked')),
  reward_days int not null default 7,
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  rewarded_at timestamptz
);
-- الكود فريد لصف الحامل فقط (صفوف المُحالين تشارك نفس الكود للتتبع)
create unique index if not exists referrals_holder
  on public.referrals(referrer_tenant_id) where referee_tenant_id is null;
create index if not exists referrals_code on public.referrals(code);
-- مُحال واحد = مكافأة واحدة (يمنح نفس الإحالة مرتين + idempotency)
create unique index if not exists referrals_one_per_referee
  on public.referrals(referee_tenant_id) where referee_tenant_id is not null;
create index if not exists referrals_referrer on public.referrals(referrer_tenant_id);
create index if not exists referrals_status on public.referrals(status);
