import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** القوالب الافتراضية — تُدمج مع تجاوزات السنتر (الأخيرة تكسب) */
const DEFAULT_TEMPLATES = [
  { key: "installment_reminder", channel: "whatsapp", title: "تذكير قسط", body: "تذكير: قسط {amount} جنيه مستحق بتاريخ {date} — {center}. ادفع الآن: {link}" },
  { key: "absence_alert", channel: "whatsapp", title: "تنبيه غياب", body: "غاب {student} عن حصة {group} اليوم {date} — {center}" },
  { key: "exam_grade", channel: "whatsapp", title: "نتيجة امتحان", body: "نتيجة {student} في {exam}: {score}/{total} — الترتيب {rank} — {center}" },
  { key: "welcome_student", channel: "whatsapp", title: "ترحيب بطالب", body: "أهلاً {student} في {center} 🎉 مجموعتك: {group} — أول حصة {date}" },
  { key: "session_reminder", channel: "whatsapp", title: "تذكير حصة", body: "تذكير: حصة {group} غداً {time} — {center}" },
  { key: "overdue_collect", channel: "whatsapp", title: "تحصيل متأخر", body: "تنبيه: متأخرات {amount} جنيه على حساب {student} — برجاء السداد — {center}" },
  { key: "payment_receipt", channel: "whatsapp", title: "إيصال دفع", body: "تم استلام دفعة ✅\nالطالب: {student}\nالمبلغ: {amount} جنيه\nإيصال رقم: {receipt}\nشكراً لكم — {center}" },
];

/** GET /api/templates — القوالب الافتراضية + تجاوزات السنتر (مالك فقط) */
export async function GET() {
  const res = await requireTeacher(R.owner);
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const { data: rows } = await sb.from("message_templates").select("key,channel,title,body,is_active").eq("tenant_id", tid);
  const byKey = new Map((rows ?? []).map((r: any) => [r.key, r]));
  return NextResponse.json({
    ok: true,
    templates: DEFAULT_TEMPLATES.map((d) => {
      const o = byKey.get(d.key) as any;
      return o
        ? { key: d.key, channel: o.channel, title: o.title, body: o.body, is_active: o.is_active, custom: true }
        : { ...d, is_active: true, custom: false };
    }),
  });
}

/** POST /api/templates {key,title?,body,channel?,is_active?} — حفظ/تجاوز قالب (مالك فقط) */
export async function POST(req: Request) {
  const res = await requireTeacher(R.owner);
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const key = String(b?.key ?? "").trim().slice(0, 60);
  const body = String(b?.body ?? "").trim().slice(0, 1000);
  if (!key || !body) return NextResponse.json({ ok: false, error: "key_and_body_required" }, { status: 400 });
  const channel = ["whatsapp", "sms", "internal"].includes(b?.channel) ? b.channel : "whatsapp";
  const title = String(b?.title ?? "").trim().slice(0, 120);
  const { error } = await sb.from("message_templates").upsert(
    { tenant_id: tid, key, channel, title, body, is_active: b?.is_active !== false, updated_at: new Date().toISOString() },
    { onConflict: "tenant_id,key" }
  );
  if (error) return dbFail("template-upsert", error);
  try {
    await sb.from("audit_log").insert({
      tenant_id: tid, actor_id: res.ctx.userRow.id,
      action: "template:upsert", entity_type: "message_template", entity_id: key, details: { key, channel },
    });
  } catch {}
  return NextResponse.json({ ok: true, key });
}
