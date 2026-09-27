-- 030: سجل أجهزة الدخول (كشف الغريب + إنهاء عن بُعد)
create table if not exists public.login_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  device_label text not null default '',
  ip_hash text not null default '',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  trusted boolean not null default false,
  revoked boolean not null default false,
  unique (tenant_id, user_id, ip_hash, device_label)
);
create index if not exists devices_user on public.login_devices(tenant_id, user_id, last_seen desc);
