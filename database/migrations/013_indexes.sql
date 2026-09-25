-- 013: فهارس المسارات الساخنة (تدقيق الجولة 3)
create index if not exists idx_exams_tenant on public.exams(tenant_id);
create index if not exists idx_users_tenant_role on public.users(tenant_id, role);
create index if not exists idx_enrollments_tenant on public.enrollments(tenant_id);
create index if not exists idx_platform_payments_tenant_status on public.platform_payments(tenant_id, status);
