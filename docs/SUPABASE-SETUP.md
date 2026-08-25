# ربط Supabase — خطوة بخطوة (10 دقائق)

## 1. إنشاء المشروع
1. ادخل [supabase.com](https://supabase.com) → New Project
2. الاسم: `manara` · المنطقة الأقرب: `Frankfurt (eu-central-1)` · اعمل Password قوي واحفظه

## 2. تنفيذ السكيما
1. من القائمة الجانبية: **SQL Editor** → New query
2. انسخ محتوى `database/schema.sql` كله والصقه → **Run**
3. المفروض ينجح بدون أخطاء — هيبني 21 جدول + RLS + بيانات تجريبية (سنتر النور)

## 3. جلب المفاتيح
من **Project Settings → API**:
- `Project URL` → ده `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → ده `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → ده `SUPABASE_SERVICE_ROLE_KEY` (**متحطش أبداً في أي ملف يترفع لجيت هب**)

## 4. ربطها بالمشروع
```bash
cp .env.example .env.local
# افتح .env.local واملأ القيم الثلاثة
```

## 5. التحقق
```bash
npm run dev
# افتح http://lvh.me:3000 — لو الصفحة فتحت عادي، الاتصال تمام
```

## 6. Auth بالـOTP المصري (اختياري دلوقتي)
1. Supabase Dashboard → Authentication → Providers → Phone → Enable
2. محتاج Twilio Verify أو MessageBird حساب للإرسال الفعلي
3. البديل المجاني مؤقتاً: Email OTP أو كلمة سر + موبايل بدون تحقق

---
**ملاحظة**: لحد ما الخطوات دي تتم، التطبيق شغال ببيانات تجريبية من `src/lib/demo-data.ts` — كل الصفحات بتشتغل طبيعي.
