/**
 * خريطة الأخطاء العربية الموحدة — لا يظهر أي كود إنجليزي للمستخدم أبداً.
 * أي مسار API يرجع { error: CODE } يجب أن يرفق message من هنا.
 */

const AR: Record<string, string> = {
  bad_json: "البيانات المرسلة غير صالحة — أعد تحميل الصفحة وحاول تاني",
  invalid_input: "راجع البيانات: الاسم ورقم الموبايل (11 رقم يبدأ بـ 01) والبريد",
  invalid_credentials: "تأكد من صحة البريد الإلكتروني",
  weak_password: "كلمة السر ضعيفة — 8 أحرف على الأقل مع حرف ورقم",
  email_exists: "هذا البريد مسجل لحساب آخر — سجّل الدخول به أو جرّب بريداً آخر",
  already_have_account: "عندك حساب بالفعل بهذا البريد — سجّل الدخول مباشرة",
  phone_exists: "رقم الموبايل مسجل مسبقاً — سجّل الدخول بحسابك الحالي",
  auth_failed: "تعذر إنشاء الحساب — حاول تاني أو كلمنا على واتساب",
  profile_failed: "تعذر حفظ بياناتك — حاول تاني",
  tenant_failed: "تعذر تجهيز سنترك — حاول تاني بعد قليل",
  server_error: "عطل مؤقت — حاول تاني بعد قليل",
  too_many_attempts: "محاولات كثيرة — انتظر ساعة وحاول تاني",
  captcha_required: "تحقق أنك لست روبوتاً ثم أعد المحاولة",
  not_configured: "الخدمة غير مفعلة حالياً — كلمنا على واتساب وسنساعدك",
  not_configured_short: "الخدمة غير مفعلة حالياً",
  missing_fields: "املأ كل الحقول المطلوبة",
  tenant_not_found: "رابط السنتر غير صحيح — تأكد من الرابط من إدارة السنتر",
  bad_phone: "رقم الموبايل غير صحيح — اكتبه 11 رقماً يبدأ بـ 01",
  not_registered: "هذا الرقم غير مسجل — سجّل أولاً أو اسأل إدارة السنتر",
  cooldown: "انتظر دقيقة قبل طلب رمز جديد",
  otp_failed: "تعذر إنشاء الرمز — حاول تاني",
  bad_code: "الرمز غير صحيح — تأكد وحاول تاني",
  expired: "انتهت صلاحية الرمز — اطلب رمزاً جديداً",
  locked: "محاولات كثيرة — اطلب رمزاً جديداً",
  no_email: "تعذر العثور على حسابك — كلمنا على واتساب",
  session_failed: "تعذر إتمام الدخول — حاول تاني",
  unauth: "انتهت جلستك — سجّل الدخول تاني",
  no_tenant: "حسابك بلا سنتر — أنشئ سنترك من هنا",
  heal_failed: "تعذر تجهيز حسابك — حاول تاني",
  no_passkeys: "لا توجد بصمة مسجلة لهذا البريد — ادخل بكلمة السر أولاً",
};

/** رسالة عربية لكود خطأ — لا ترجع الكود الخام أبداً */
export function arError(code?: string | null, fallback?: string | null): string {
  if (code && AR[code]) return AR[code];
  if (fallback && !/^[a-z_]+$/.test(fallback)) return fallback; // رسالة بشرية جاهزة
  return "حدث خطأ — حاول تاني أو كلمنا على واتساب";
}

/** ترجمة رسائل Supabase Auth الإنجليزية لعربية مفهومة */
export function supabaseAuthError(message?: string | null): string {
  const m = (message ?? "").toLowerCase();
  if (!m) return arError(null);
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("email or password"))
    return "البريد أو كلمة السر غير صحيحة — تأكد وحاول تاني";
  if (m.includes("email not confirmed") || m.includes("not confirmed"))
    return "بريدك غير مؤكد — افتح رابط التفعيل في بريدك أو كلمنا واتساب";
  if (m.includes("too many") || m.includes("rate limit") || m.includes("too_many"))
    return "محاولات كثيرة — انتظر 5 دقائق وحاول تاني";
  if (m.includes("already registered") || m.includes("already exists") || m.includes("already been registered"))
    return "هذا البريد مسجل بالفعل — سجّل الدخول بدل إنشاء حساب";
  if (m.includes("network") || m.includes("fetch") || m.includes("failed to"))
    return "تعذر الاتصال بالخادم — تأكد من الإنترنت وحاول تاني";
  if (m.includes("password") && m.includes("6"))
    return "كلمة السر قصيرة — 8 أحرف على الأقل مع حرف ورقم";
  if (m.includes("user not found"))
    return "لا يوجد حساب بهذا البريد — أنشئ حساباً جديداً";
  return "حدث خطأ في الدخول — حاول تاني أو كلمنا على واتساب";
}
