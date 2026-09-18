-- ترحيل 003: رموز تحقق الهاتف (OTP) + قناة واتساب للإشعارات
-- التنفيذ: الصق هذا الملف كاملاً في Supabase Dashboard → SQL Editor → Run
-- (مرة واحدة فقط — آمن التكرار بفضل IF NOT EXISTS)

-- 1) جدول رموز التحقق
create table if not exists otp_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  phone text not null,
  purpose text not null,               -- link_student | parent_verify | ...
  code_hash text not null,             -- sha256 hex للرمز (لا نخزن الرمز نفسه)
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_otp_lookup
  on otp_codes(tenant_id, phone, purpose, created_at desc);

-- ملاحظة: نظّف الرموز المنتهية دورياً من لوحة التحكم عند الحاجة
-- delete from otp_codes where expires_at < now() - interval '1 day';

-- 2) السماح بقناة whatsapp في سجل الإشعارات (المرسلة عبر Cloud API)
do $$
begin
  -- احذف قيد القناة القديم فقط (نميزه بنص تعريفه)، ونُبقي باقي القيود
  declare r record;
  begin
    for r in
      select conname from pg_constraint
      where conrelid = 'notification_log'::regclass and contype = 'c'
        and pg_get_constraintdef(oid) like '%channel%'
    loop
      begin
        execute format('alter table notification_log drop constraint %I', r.conname);
      exception when others then null;
      end;
    end loop;
  end;
  alter table notification_log
    add constraint notification_log_channel_check
    check (channel in ('push','telegram','whatsapp_manual','whatsapp','sms','inapp'));
end $$;
