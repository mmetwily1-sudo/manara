# الجولة 21 — أول دفعة من الـ279 (نفاد باقة + تمديد ذاتي + قوالب رسائل)

## المنفذ (3 ميزات)
1. **تنبيه نفاد الباقة للمدفوعين** (Grok #29): بانر يظهر عند `plan_paid_until ≤ 7 أيام` + زر تجديد؛ `tenant/info` يعيد أيام الباقة بدل null.
2. **تمديد تجربة ذاتي** (عرض تجديد ذكي): `POST /api/tenant/extend-trial` — +3 أيام مرة واحدة فقط (flag بـ settings + audit) + زر "تمديد مجاني 🎁" ببانر المنتهية.
3. **قوالب رسائل السنتر** (ChatGPT #29): ترحيل `022_message_templates` + `GET/POST /api/templates` (افتراضيات 6 + تجاوز مالك + audit) + صفحة `/dashboard/templates` (تخصيص + نسخ).

## التحقق الحي (2026-09-27)
- الترحيل عبر SQL Editor بالجسر (حقن monaco + Run): `Success` + `count(*)=1 row` بلا خطأ 42P01.
- `tsc` نظيف؛ `next build` ناجح (بعد إصلاح: لا `export` غير routes من route.ts).
- إنتاج محلي fresh: `/`=200، `/dashboard/templates`=200، `POST /api/templates`=401، `POST extend-trial`=401، `GET /api/templates`=401 (البوابات تعمل، لا 500/404).

## ملاحظة
- أول ترحيل يُنفذ عبر تبويب SQL Editor جديد بالجسر (النقر البرمجي كان يخطئ؛ النقر عبر JS يعمل).
