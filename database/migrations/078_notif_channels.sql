-- 078: توسيع قنوات وحالات سجل الإشعارات (webpush/email/skipped كانت تُرفض silently)
alter table public.notification_log drop constraint if exists notification_log_channel_check;
alter table public.notification_log add constraint notification_log_channel_check
  check (channel in ('push', 'webpush', 'telegram', 'email', 'whatsapp', 'whatsapp_manual', 'sms', 'inapp'));
alter table public.notification_log drop constraint if exists notification_log_status_check;
alter table public.notification_log add constraint notification_log_status_check
  check (status in ('queued', 'sent', 'failed', 'read', 'skipped', 'info'));
