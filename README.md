# منارة (Manara) 🏗️

> نظام تشغيل المعلم والسنتر — منصة تعليمية White-label للمعلمين في مصر
> كل معلم ياخد منصته الخاصة بدومين باسمه، تربطه بطلابه وأولياء أمورهم.

## المعمارية

| الطبقة | التقنية |
|---|---|
| Frontend + Backend | Next.js 14 (App Router) + TypeScript |
| قاعدة البيانات | PostgreSQL عبر Supabase + **RLS لعزل الـtenants** |
| التصميم | Tailwind CSS — عربي RTL أصيل، خط Cairo |
| Multi-Tenancy | Subdomain لكل معلم (`ahmed.manara.app`) + دومين مخصص |

## الهيكل

```
manara/
├── database/schema.sql      ← السكيما الكاملة + RLS policies (نفّذها في Supabase)
├── src/
│   ├── middleware.ts        ← استخراج tenant من الـhost (subdomain/custom domain)
│   ├── lib/
│   │   ├── tenant.ts        ← قراءة سياق الـtenant في Server Components
│   │   └── supabase.ts      ← عملاء Supabase (browser/server)
│   └── app/
│       ├── page.tsx         ← الموقع التسويقي (الهيكل الذهبي)
│       ├── pricing/         ← الباقات 450 / 750 / 1500
│       ├── join/            ← wizard التجربة المجانية
│       ├── login/           ← الدخول
│       └── [teacher]/       ← صفحات المعلمين العامة (Programmatic SEO)
```

### التشغيل
```bash
npm install        # أول مرة فقط (ممكن ياخد دقايق على شبكة بطيئة)
npm run build      # بناء الإنتاج — الأسرع للمعاينة
npm run start      # يخدم نسخة الـbuild على http://localhost:3000
# أو للتطوير الحي (أول تحميل بياخد وقت للترجمة الباردة — استنى رسالة Ready):
npm run dev
```

### النشر على GitHub
شغّل `push-to-github.ps1` مرة واحدة (زرار يمين → Run with PowerShell) — هيعمل تسجيل الدخول وإنشاء الريبو والرفع تلقائياً.

### قاعدة البيانات
انظر `docs/SUPABASE-SETUP.md` — لحد ما تتربط، التطبيق شغال ببيانات تجريبية من `src/lib/demo-data.ts`.

### اختبار الـSubdomains محلياً ⚠️
متعملش `localhost` — استخدم:
- `http://lvh.me:3000` → الموقع التسويقي
- `http://demo.lvh.me:3000` → منصة "سنتر النور التجريبي"

(`lvh.me` بيوجّه أي subdomain منه لـ127.0.0.1 تلقائياً)

### قاعدة البيانات
نفّذ `database/schema.sql` في SQL Editor بتاع Supabase.
السكيمة فيها: tenants · users بأدوار · groups/sessions/attendance · questions/exams · videos · assignments/payments · threads/messages · certificates · notification_log · platform billing · audit_log — **كلها معزولة بـRLS**.

## خارطة الطريق
انظر `ROADMAP.md` — المراحل الثلاث من الـMVP حتى التوسع.

## المرجعيات (Skills)
كل القرارات المعمارية والتسعيرية والتصميمية موثقة في:
`Desktop\opencode\skills\` (26 skill للمشروع)
