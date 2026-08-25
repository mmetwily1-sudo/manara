# ROADMAP — منارة

> القاعدة الاستراتيجية: سرعة الوصول للسوق أهم من كمال الميزات.
> سمارت سنتر (590K طالب) داخلة مجالنا — لازم نسبقهم للدمج الكامل.

## Phase 1 — Core MVP (8-12 أسبوع) 🔴 الحالي
**الهدف: أول عميل مدفوع**

### الأسبوع 1-2: الأساس
- [x] Skeleton المشروع + middleware الـtenants ✅ (تم)
- [ ] ربط Supabase + تنفيذ schema.sql + Auth بالأرقام المصرية (OTP)
- [ ] لوحة إنشاء السنتر (onboarding wizard + demo data seeding)
- [ ] Tenant theming (لون + لوغو حي)

### الأسبوع 3-4: التحضير والمجموعات
- [ ] المجموعات والجدول الأسبوعي + توليد الجلسات
- [ ] شاشة التحضير (tap-grid + QR + كود طالب)
- [ ] Offline-first sync (IndexedDB queue)

### الأسبوع 5-6: المالية والإشعارات
- [ ] التحصيل (كاش أولًا): دفعات كاملة/جزئية + إيصالات PDF + تقفيل الخزنة
- [ ] Push notifications داخلية (Web Push) + Telegram bot fallback
- [ ] بوابة ولي الأمر (3 شاشات فقط)

### الأسبوع 7-9: المحتوى والامتحانات
- [ ] رفع فيديوهات Bunny Stream + مشغل محمي signed tokens
- [ ] بنك أسئلة + استيراد Excel + مولد الامتحانات MCQ
- [ ] شاشة الامتحان (autosave + مؤقت server-side + منع غش أساسي)

### الأسبوع 10-12: الإطلاق
- [ ] الشهادات التلقائية + صفحة verification عامة
- [ ] Super Admin panel مصغر (tenants + اشتراكات يدوية)
- [ ] الموقع التسويقي كامل + 12 مقال SEO
- [ ] **5 معلمين pilot مجاناً مقابل testimonial**

## Phase 2 — Money & Growth (بعد أول 10 عملاء) 🟡
- [ ] Paymob integration (بطاقات + محافظ) مع webhook آمن
- [ ] الفواتير الآلية + dunning UX محترم
- [ ] برنامج الإحالة (أيام مقابل أيام)
- [ ] صفحات المعلمين العامة + Programmatic SEO
- [ ] منتدى ورسائل (voice notes)
- [ ] Live classes Phase 1 (تكامل Zoom/Meet + حضور آلي)
- [ ] تطبيق APK باسم السنتر (سنتر بلس)

## Phase 3 — Differentiators 🟢
- [ ] AI assistant ("مين مادفعش؟") + توليد أسئلة من المذكرات
- [ ] Interactive video (أسئلة داخل الفيديو — LearnWorlds pattern)
- [ ] Gamification كامل (نقاط/متصدرون/شارات/هدايا)
- [ ] محرر أكواد للموبايل (معلمي البرمجة — Judge0/Piston)
- [ ] امتحانات شبكة محلية بدون نت (نمط مُدرِّس)
- [ ] Native live streaming (100ms/Agora) — قرار حسب الإيراد

## مقاييس نجاح Phase 1
| المؤشر | الهدف |
|---|---|
| Activation (استورد طلاب + حضّر جلسة خلال 7 أيام) | ≥ 60% |
| Trial → Paid | ≥ 25% |
| أول رد دعم | ≤ ساعتين |
