-- 023: مكتبة قوالب امتحانات السنتر (حفظ هيكل امتحان وإعادة استخدامه)
create table if not exists public.exam_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  subject text not null default '',
  blueprint jsonb not null default '{"question_ids":[]}',
  duration_minutes int not null default 30,
  created_at timestamptz not null default now()
);
create index if not exists exam_templates_tenant on public.exam_templates(tenant_id);
