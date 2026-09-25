-- 019: طابور SMS الاحتياطي (Outbox) — يُملأ عند فشل Push للتنبيهات الحرجة
create table if not exists public.sms_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  phone text not null,
  body text not null,
  event text not null default '',
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists sms_queue_status on public.sms_queue(status, created_at);
create index if not exists sms_queue_tenant on public.sms_queue(tenant_id);
