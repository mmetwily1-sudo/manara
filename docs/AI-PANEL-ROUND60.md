# الجولة 60 — بوابة ولي الأمر + دفع أونلاين

## المنفذ (ميزتان)
1. **بوابة ولي الأمر**: `parent_portal_sessions` (044: توكين hashed + انتهاء سنة)؛ `POST /api/parent/token` (معلم) + `GET /api/parent/portal` (عام بالتوكين: بيانات الطالب + فواتيره) + صفحة `/parent`.
2. **الدفع الأونلاين**: `POST /api/parent/pay` (card/wallet ضد فاتورة ولي الأمر) + `tenants.online_payment_enabled` + `paymob_webhook_url` (التفعيل الحي بيد المالك).

## التحقق الحي
- `tsc` نظيف؛ بناء ناجح؛ `/parent`=200؛ portal بدون توكين=401 (متوقع).
