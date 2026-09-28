-- 069: مفاتيح API (hash فقط + إلغاء + آخر استخدام)
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null default '',
  key_prefix text not null default '',
  key_hash text not null,
  revoked boolean not null default false,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists api_keys_hash on public.api_keys(key_hash);
