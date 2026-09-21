-- الترحيل 009: فجوات المعرفة (حلقة التعلم الذاتي للوكيل)
-- التطبيق: Supabase Dashboard → SQL Editor → Run (مرة واحدة، آمن مع IF NOT EXISTS)

-- أسئلة فشل الوكيل في الإجابة عنها من المعرفة → تُحصد تلقائياً لاحقاً
create table if not exists knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  hits int not null default 1,
  status text not null default 'open' check (status in ('open','filled','ignored')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(query)
);
create index if not exists idx_gaps_status on knowledge_gaps(status, hits desc);
