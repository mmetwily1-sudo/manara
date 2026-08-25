# ملاحظات التعلم من المشاريع المرجعية

## المصدر: vercel/nextjs-subscription-payments (النمط الرسمي لـSupabase SaaS)

### 1. نمط Supabase Auth في Middleware
```ts
// السر: تحديث الجلسة في كل request عبر تمرير cookies ذهاباً وإياباً
const supabase = createServerClient(url, key, {
  cookies: {
    getAll() { return request.cookies.getAll(); },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request }); // إعادة بناء الresponse بالكوكيز المحدثة
      cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    },
  },
});
await supabase.auth.getUser(); // refresh token تلقائياً
```
**التطبيق عندنا**: لما نشغل Supabase، هندمج ده في middleware.ts الحالي (بعد منطق tenant) عشان الجلسة تتحدث دايماً قبل ما توصل لأي صفحة.

### 2. Server Client مع next/headers
```ts
import { cookies } from "next/headers";
const cookieStore = cookies();
createServerClient(url, key, { cookies: { getAll: () => cookieStore.getAll() } });
```
- set داخل Server Component بيرمي error — يتجاهل بأمان (المسؤول عن الكتابة هو middleware)
- أنماط queries في utils/supabase/queries.ts منفصلة عن الـUI — نفس فلسفة data layer بتاعتنا

### 3. هيكل المشروع المستفاد
- types_db.ts مولّد من Supabase CLI (`supabase gen types`) — هنعمل مثله بعد أول migration
- migrations folder منظمة بالتواريخ — schema.sql الحالي هيتحول لمجلد migrations لاحقاً
- Route handlers للـwebhooks (Stripe) — هنعمل مثله لـPaymob في Phase 2

## قرارات معمارية مؤكدة بعد الدراسة
1. طبقة data access واحدة (src/lib/data.ts) — كل الصفحات تستدعي منها، صفر استعلامات مباشرة في UI
2. Demo mode: نفس الinterface يرجع بيانات ثابتة لما env ناقص — التبديل سطر واحد
3. Auth guard هيكون في middleware (مش في كل صفحة) — زي النمط المرجعي
