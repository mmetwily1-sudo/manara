-- 065: سر التحقق بخطوتين للمالك (TOTP)
create table if not exists public.owner_secrets (
  user_id uuid primary key references public.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  totp_secret text not null default '',
  totp_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
