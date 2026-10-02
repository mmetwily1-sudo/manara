-- 077: قنوات المنصة (تليجرام + عداد واتساب لكل سنتر)
create table if not exists public.telegram_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  chat_id bigint not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index if not exists telegram_links_chat on public.telegram_links(chat_id);

create table if not exists public.wa_usage (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  month text not null,
  count integer not null default 0,
  primary key (tenant_id, month)
);
