-- 070: مزايا السنتر (تفعيل/إيقاف الوحدات — الغائب = مفعل)
create table if not exists public.tenant_features (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);
