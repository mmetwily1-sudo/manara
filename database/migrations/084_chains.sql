-- ============================================================
-- Migration 084 — وضع السلاسل والفرنشايز (Chains)
-- تصميم: لا نلمس policies tenant_isolation الموجودة إطلاقاً (85+ جدول) —
-- الخطر كبير جداً لتعديلها جماعياً. بدل ذلك: جدول عضوية منفصل
-- (chain_members) يُستهلك من طبقة التطبيق فقط (service_role + فحص صريح)،
-- بنفس نمط requireTeacher/requirePlatformAdmin المستخدم في كل المشروع.
-- ============================================================

create table if not exists chains (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid references users(id),
  created_at timestamptz not null default now()
);

-- عضوية إدارة السلسلة — مستقلة عن tenant_id لأن مدير السلسلة قد لا ينتمي
-- لسنتر واحد بعينه (أو ينتمي لأكثر من واحد).
create table if not exists chain_members (
  chain_id uuid not null references chains(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'chain_admin' check (role in ('chain_admin','chain_viewer')),
  created_at timestamptz not null default now(),
  primary key (chain_id, user_id)
);

-- ربط السنتر بسلسلة (nullable — سنتر مستقل بلا chain_id يبقى يعمل عادي)
alter table tenants add column if not exists chain_id uuid references chains(id);
create index if not exists idx_tenants_chain on tenants(chain_id);

-- RLS: السلسلتين الجديدتين تُقرآن فقط عبر service_role من API مُتحقَّق منه
-- يدوياً (نفس نمط باقي المشروع) — لا نفتح قراءة مباشرة بمفتاح anon.
alter table chains enable row level security;
create policy chains_admin_only on chains for all
  using (is_platform_admin()) with check (is_platform_admin());

alter table chain_members enable row level security;
create policy chain_members_admin_only on chain_members for all
  using (is_platform_admin()) with check (is_platform_admin());
