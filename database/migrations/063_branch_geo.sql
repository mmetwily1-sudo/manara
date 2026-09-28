-- 063: إحداثيات الفروع للخرائط (بدون مفتاح API — رابط Google Maps)
alter table public.branches add column if not exists lat numeric;
alter table public.branches add column if not exists lng numeric;
