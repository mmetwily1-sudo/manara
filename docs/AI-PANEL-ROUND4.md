# AI Panel — الجولة 4 الكبيرة (2026-09-25): Push + تصحيح الأوفلاين + صوت المعلم

## الأصوات
- Gemini Flash (مباشر): VAPID خاص سيرفر فقط + حذف 410 فوراً + `pushsubscriptionchange` + لا push من SQL triggers + UUIDs للـidempotency.
- ChatGPT (مباشر): endpoint فريد + `getSubscription()` عند الفتح + لا ثقة بمدة ثابتة + أخطاء 429/5xx بـbackoff + بنية (client_mutation_id/sequence/retry/status) + IndexedDB عندما يكبر الطابور.
- Claude Sonnet: لم يُسأل هذه الجولة (تغطية كافية من الاثنين + سياق الجولات).

## تصحيح مهم (أمانة علمية)
- ادعاء «لا أوفلاين» في الجولة 3 كان **خاطئاً**: `AttendanceGrid` يملك طابور localStorage + مزامنة تلقائية ويعمل. أُعيدت الصياغة للحقيقة الدقيقة (التسجيل يعمل دون نت بعد فتح الصفحة أول مرة).
- التحضير idempotent أصلاً (upsert على session+student) — إعادة إرسال الطابور آمنة.

## ما نُفذ (E2E أخضر)
- ترحيل `014_push.sql`: `push_subscriptions` (endpoint فريد + فهرس مستخدم).
- ترحيل `015_feedback.sql`: `feedback` (nps/idea/bug/praise + score 1-10).
- `lib/push.ts`: إرسال server-side فقط + حذف الميت (404/410) + تحديث `last_seen_at`.
- APIs: `push/public-key` + `push/subscribe` (اشتراك/إلغاء، أي دور) — ربط `notifyStudent` بمروحة webpush + سطر `notification_log` قناة webpush.
- `public/sw.js` (عرض + نقر + إعادة تسجيل) + `PushBootstrap` في الجذر + زر `PushSubscribeButton` في الإعدادات وصفحة التقدم.
- `FeedbackWidget` (NPS + اقتراح/بلاغ/شكر، حد 20/يوم) + `/admin/feedback` (متوسط + عدّادات + أحدث 50).
- مفاتيح VAPID مولّدة محلياً (`web-push` أُضيفت للاعتماديات).
- تنظيف 4 سناتر اختبار يتيمة (7 حسابات) خلفتها تشغيلات متعثرة — تُرك سنتر `mr-z7ef` (به حركة دفع، يُراجع يدوياً).

## تحقق حي
- اشتراك/إعادة (بلا تكرار)/إلغاء ✓ · NPS وفكرة ✓ · رفض الفارغ ✓ · غياب حقيقي → إشعار دون كسر + بقاء الاشتراك الميت المؤقت ✓.

## مطلوب من المالك (عمليات — ليست كوداً)
1. أضف في Vercel: `VAPID_SUBJECT` + `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (القيم في `.env.local` سطور 31-34) — بدونها الـpush يعمل محلياً فقط.
2. راجع سنتر `mr-z7ef` (طالب الاختبار + دفعة) — حقيقي أم اختبار؟

## المؤجل
- IndexedDB للطابور + Realtime heartbeat + Proctoring كاميرا — بعد قياس الطلب.
- مكافأة الإحالة بسعة طلاب — بعد استقرار الأيام.
