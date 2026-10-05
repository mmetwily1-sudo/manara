-- 081: إعدادات المنصة (ثيم المالك + قفل تخصيص السناتر)
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
insert into public.platform_settings(key, value) values
  ('design', '{"admin_accent": "", "lock_tenant_design": false}')
on conflict (key) do nothing;
