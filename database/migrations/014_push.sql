-- 014: اشتراكات Web Push (إشعارات الغياب والنتائج حتى والتطبيق مقفول)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
-- endpoint فريد عالمياً: نفس الجهاز = صف واحد (يُحدَّث عند إعادة الاشتراك)
create unique index if not exists push_sub_endpoint on public.push_subscriptions(endpoint);
create index if not exists push_sub_user on public.push_subscriptions(tenant_id, user_id);
