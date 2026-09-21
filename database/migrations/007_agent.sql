-- الترحيل 007: ذاكرة وكيل منارة (محادثات + رسائل)
-- التطبيق: Supabase Dashboard → SQL Editor → Run (مرة واحدة، آمن مع IF NOT EXISTS)

create table if not exists agent_threads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  title text not null default 'محادثة جديدة',
  created_at timestamptz not null default now()
);
create index if not exists idx_agent_threads_user on agent_threads(tenant_id, user_id, created_at desc);

create table if not exists agent_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  thread_id uuid not null references agent_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool')),
  content text,
  tool_name text,
  created_at timestamptz not null default now()
);
create index if not exists idx_agent_messages_thread on agent_messages(thread_id, created_at asc);
