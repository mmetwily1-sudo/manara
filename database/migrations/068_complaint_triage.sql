-- 068: تصنيف الشكاوى وأولويتها تلقائياً
alter table public.complaints add column if not exists category text not null default 'general';
alter table public.complaints add column if not exists priority text not null default 'normal' check (priority in ('normal', 'high'));
create index if not exists complaints_cat on public.complaints(tenant_id, category, priority);
