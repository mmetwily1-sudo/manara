# AI Panel — الجولة 10 (2026-09-25): استقرار النشر + حمل الإنتاج

## استقرار النشر (مثبت بالجسر)
- كل النشرات Ready بما فيها الأحدث `f74e3ea` (Production) — لا إصلاح لزم.
- الإنتاج حي: health/VAPID/public-stats/home كلها 200.

## حمل الإنتاج الخفيف (180 طلب، صفر شاذ — حدود اللجنة: تزامن 5)
| المسار | p50 | p95 |
|---|---|---|
| / | 116ms | 788ms |
| health/stats/push-key | ~95ms | ~330ms |
| exams(auth) | 902ms | 1651ms |
| payments(auth) | 922-1437ms | 1498-6127ms* |
\* قفزة 6.1s شاذة واحدة (cold cascade) — المتسلسل المستقر p95 ≈ 2.2s.

## تحسين منفذ
- `GET payments` + `GET invoices`: استعلامات متوازية (كانت متسلسلة). الأرضية ~700ms شبكية (fra→EU) لا تُكسر محلياً.

## استراتيجية اللجنة المعتمدة
- DeepSeek/Grok/Claude/Gemini/ChatGPT: تزامن ≤10، راقب egress (5GB) واتصالات (60)، تجنب Auth المتكرر، تنبيه UptimeRobot/Better Stack على `/api/health` كل 5 دقائق (حد >2s).

## على المالك (دقيقتان)
- أنشئ مراقب UptimeRobot مجاني على `https://manara-mmetwily.vercel.app/api/health` كل 5 دقائق + تنبيه تيليجرام.
