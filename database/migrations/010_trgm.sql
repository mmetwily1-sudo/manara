-- الترحيل 010: بحث دلالي عربي داخل Postgres (pg_trgm — بلا خدمات خارجية)
-- التطبيق: Supabase Dashboard → SQL Editor → Run (مرة واحدة، آمن مع IF NOT EXISTS)

create extension if not exists pg_trgm;

-- دالة البحث الدلالي: similarity على العنوان والمتن مع عتبة pg_trgm الافتراضية
create or replace function match_knowledge(q text, lim int default 8)
returns table (
  id uuid, kind text, system text, title text, body text,
  source_url text, effective_date date, score real
)
language sql stable as $$
  select id, kind, system, title, body, source_url, effective_date,
         greatest(similarity(title, q), similarity(body, q)) as score
  from edu_knowledge
  where title % q or body % q
  order by score desc
  limit lim;
$$;
