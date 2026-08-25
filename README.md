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

## التشغيل المحلي

```bash
npm install
cp .env.example .env.local    # واملأ مفاتيح Supabase
npm run dev
```

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
