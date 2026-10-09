-- 089: خصم التجديد المبكر — حقل تدقيق واحد على فواتير المنصة.
-- الحساب سيرفر-سايد في billing/pay (5% شهري فقط، renewal_state ∈ {active, due_soon})،
-- والعميل لا يرسل الأهلية أبداً. لا RLS جديد (جدول موجود ومغطى).
alter table public.platform_payments
  add column if not exists discount_pct numeric null;
