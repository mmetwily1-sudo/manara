# دليل النشر — منارة

## الخيار الموصى به: Vercel (الأسرع والأرخص للبداية)

### 1. الربط بـGitHub
بعد رفع الكود على GitHub:
1. [vercel.com](https://vercel.com) → Add New → Project → اختار repo `manara`
2. Framework Preset: Next.js (بيتكشف لوحده)
3. متضفش env دلوقتي — التطبيق شغال Demo mode بدونها

### 2. المتغيرات (لما تجهز Supabase)
Project Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   (Secret فقط)
NEXT_PUBLIC_ROOT_DOMAIN=manara.app
```

### 3. الدومين والـSubdomains ⚠️ (أهم خطوة)
عشان `ahmed.manara.app` يشتغل:
1. Vercel Project → Domains → أضف `manara.app` و `*.manara.app`
2. عند مزود الدومين:
   - `A record`: @ → `76.76.21.21`
   - `CNAME`: * → `cname.vercel-dns.com`
3. SSL تلقائي لكل subdomain — بدون أي إعداد إضافي (نفس وعدنا في skill المعمارية)

### 4. قاعدة البيانات الإنتاجية
- Supabase project منفصل عن التطوير أو نفسه مع branching
- نفّذ `database/schema.sql` مرة واحدة
- فعّل Point-in-Time Recovery لما تدفع للخطة المدفوعة

## بدائل
| المنصة | متى |
|---|---|
| **Vercel** | البداية — مجاني حتى traffic معقول، wildcard domains سهلة |
| **Hetzner VPS + Docker** | عند نمو التكلفة (~$20/شهر ثابتة) — انظر skill saas-devops-testing |

## Checklist ما بعد أول Deploy
- [ ] افتح الرابط — الرئيسية تظهر عربي RTL سليم
- [ ] `https://demo.manara.app` → صفحة المعلم التجريبية
- [ ] Lighthouse على الرئيسية: Performance ≥ 90 · Accessibility ≥ 95
- [ ] CI أخضر على جيت هب
