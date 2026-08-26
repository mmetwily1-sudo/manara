# 📖 Bridge Playbook — المهام والأوامر المحفوظة
> آخر تحديث: بعد جلسة ربط Supabase — كل الأوامر المجربة والفخاخ المعروفة

## البنية الأساسية
- الجسر: WebSocket `ws://localhost:9878` — السيرفر: `Desktop\bridge\source\server\index.js`
- CLI عام: `node cli.js <command> --param value [--extensionId <client-id>]`
- المتصفحات المتصلة: `node cli.js bridge.extensions` → قائمة `{id, connectedAt}`
- **routing**: أي أمر بدون extensionId يروح لأول عميل؛ مع extensionId يروح للمحدد ويُحذف من البارامز قبل التمرير

## أوامر مجربة ✓
| الأمر | صيغة |
|---|---|
| قائمة التابات | `cli.js tabs.list --extensionId X` |
| تاب جديد | `cli.js tabs.create --extensionId X --url URL` |
| تنقل/تفعيل | `cli.js tabs.update --tabId N --extensionId X --json '{"updateProperties":{"url":"...","active":true}}'` |
| إغلاق | `cli.js tabs.remove --tabId N --extensionId X` |
| تحديث | `cli.js tabs.reload --tabId N --extensionId X` |
| JS في صفحة | `node evalX.cjs <extId> <tabId> file.js` (يدعم async عبر awaitPromise ✓ + detach تلقائي ✓) |
| نقرة حقيقية بإحداثيات | `node mclickX.cjs <extId> <tabId> x y` |
| إدخال نص كبير | ⚠️ Input.insertText بيعلق CDP فوق ~2KB — استخدم monaco setValue أو تقسيم |
| فصّل debugger عالق | `node det.cjs <extId> <tabId>` |

## سكربتات مساعدة اتنشأت (في server/)
- `evalX.cjs` — تقييم مع async+detach (الأصل ev.js بيفشل مع async)
- `mclickX.cjs` — نقر حقيقي multi-browser
- `det.cjs` — فصل debugger لكل الإصدارات
- `filllogin.cjs` — تعبئة حقل بإيميل (نمط عام لأي حقل)
- `runSQL.cjs` — يجد زرار Run/يضغط Ctrl+Enter ويقرأ النتيجة

## ⚠️ الفخاخ المكتشفة (مهم جداً)
1. **ev.js القديم**: مفيش awaitPromise → async expressions ترجع `{}`
2. **كل تشغيل eval بدون detach** = "Another debugger attached" في المرة الجاية → دايماً detach قبل exit
3. **Input.insertText للنصوص الكبيرة** = timeout + تجميد renderer → استخدم monaco model.setValue عبر evaluate واحد (نجح 17KB ✓)
4. **element.click() برمجياً** بيتجاهل في SPA handlers → لازم نقرة CDP حقيقية (mclickX)
5. **PS 5.1**: مفيش `??` operator · ev.js output JSON مُهرَّب (`\"`) ينظف قبل ConvertFrom-Json
6. **العميل اللي بيرجع 0 tabs** ممكن يكون متصفح حقيقي — جرب tabs.create عليه مباشرة ثم افحص
7. Harness بيقتل node المعلق → كله يحتاج self-timeout داخلي + خطوات قصيرة منفصلة

## 🎯 Pipeline ربط Supabase الكامل (المهمة الحالية)
```
1. bridge.extensions → عدّد المتصفحات
2. لكل متصفح: tabs.create github.com → افحص meta[user-login]
   ⇒ المتصفح اللي يرجع "mmetwily1-sudo" = الهدف
3. فيه: tabs.create → https://supabase.com/dashboard/project/tshpfgdcpdaouznxpcne/sql/new
   (لو وقع على sign-in: اضغط Continue with GitHub بنقرة حقيقية → Authorize)
4. حقن schema.sql: base64 decode → window.monaco.editor.getModels()[0].setValue(sql)
   ✓ مجرب: method=monaco-model len=17091
5. شغّل runSQL.cjs (زرار Run عند 1480,117 أو Ctrl+Enter)
6. تحقق: GET {ref}.supabase.co/rest/v1/tenants مع sb_publishable key → 200 []
7. E2E محلي: POST /api/trial → mode:"live" + slug جديد
8. Commit + Push
```

## حالة آخر محاولة
- خطأ أول تنفيذ: `42703 tenant_id does not exist` → **اتصلح** في database/schema.sql (exam_questions + message_reads)
- المحرر بيتجمد مع المحاولات الكبيرة → حلّه: reload التاب ثم محاولة واحدة نظيفة على تاب جديد
- المفاتيح الفعلية في `.env.local` ✓ · REST ping يعمل ✓ (404 قبل السكيما)
