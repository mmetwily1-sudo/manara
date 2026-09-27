# الجولة 27 — مركز إشعارات موحد + قواعد لكل حدث + تثبيت PWA

## المنفذ (3 ميزات)
1. **المركز الموحد**: `GET /api/notifications` (سجل القنوات + طابور SMS بالأسماء) + صفحة `/dashboard/notifications`.
2. **قواعد مخصصة**: `GET/PATCH /api/tenant/notify-rules` (6 أحداث) — الإيقاف يُسجل `skipped` ولا يرسل؛ تُحترم داخل `notifyStudent`.
3. **تثبيت PWA**: زر `InstallPwa` (يظهر عند دعم المتصفح) باللوحة الرئيسية.

## التحقق الحي (2026-09-27)
- `tsc` نظيف؛ `next build` ناجح (بعد إصلاح `export` زائد ثانٍ من route).
- إنتاج محلي: `/api/notifications`=401، `/api/tenant/notify-rules`=401 (لا 500).
