-- 088: ترقيع settings الذري — يقفل سباق read-modify-write على عمود JSONB.
-- المشكلة: كاتبان (كرون التجديد + callback الدفع) كانا يقرآن settings كاملاً ثم
-- يكتبانه spread — فكتابة متأخرة مبنية على قراءة قديمة كانت تمسح مفاتيح الكاتب
-- الآخر (فعلياً: plan_paid_until جديد يُمحى). الحل: كل كاتب يلمس مفاتيحه فقط
-- بعملية SQL واحدة، فلا نافذة تعارض أصلاً (لا أقفال ولا CAS).
create or replace function public.tenant_patch_settings(p_tenant_id uuid, p_patch jsonb, p_plan text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tenants
  set plan = coalesce(p_plan, plan),
      settings = coalesce(settings, '{}'::jsonb) || p_patch
  where id = p_tenant_id;
end $$;

-- الدالة للـservice_role فقط (تُستدعى من السيرفر عبر rpc) — ليست لعموم الأدوار.
revoke all on function public.tenant_patch_settings(uuid, jsonb, text) from public;
grant execute on function public.tenant_patch_settings(uuid, jsonb, text) to service_role;
