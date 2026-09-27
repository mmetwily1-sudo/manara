-- 041: قفل النقاشات + تصنيف المذكرات بالدروس
alter table public.threads add column if not exists locked boolean not null default false;
alter table public.products add column if not exists subject text not null default '';
alter table public.products add column if not exists lesson text not null default '';
create index if not exists products_subject on public.products(tenant_id, subject);
