import { NextResponse } from "next/server";
import { requireTeacher, adminClient } from "@/lib/server-auth";

const EVENTS = [
  { kind: "attendance_absent", label: "تنبيه الغياب 📋" },
  { kind: "exam_graded", label: "نتيجة امتحان 📝" },
  { kind: "payment_received", label: "استلام دفعة ✅" },
  { kind: "payment_reminder", label: "تذكير مصروفات 🔔" },
  { kind: "homework_submitted", label: "واجب جديد 📝" },
  { kind: "homework_graded", label: "تصحيح واجب 📝" },
];

/** GET /api/tenant/notify-rules — قواعد الإشعارات لكل حدث (مالك) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const { data: t } = await adminClient().from("tenants").select("settings").eq("id", res.ctx.tenantId).single();
  const rules = ((t as any)?.settings?.notify_rules ?? {}) as Record<string, boolean>;
  const snooze = ((t as any)?.settings?.notify_snooze ?? {}) as Record<string, string>;
  return NextResponse.json({
    ok: true,
    events: EVENTS.map((e) => ({ ...e, enabled: rules[e.kind] !== false, snoozed_until: snooze[e.kind] ?? null })),
  });
}

/** PATCH /api/tenant/notify-rules {kind, enabled} — تفعيل/إيقاف حدث (مالك) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const b = await req.json().catch(() => ({} as any));
  if (!EVENTS.some((e) => e.kind === b?.kind)) {
    return NextResponse.json({ ok: false, error: "bad_rule" }, { status: 400 });
  }
  const { data: t } = await admin.from("tenants").select("settings").eq("id", res.ctx.tenantId).single();
  const settings = { ...((t as any)?.settings ?? {}) };
  if (typeof b?.snooze_days === "number" && b.snooze_days >= 1 && b.snooze_days <= 30) {
    // كتم مؤقت: يعود تلقائياً بعد المدة
    const until = new Date(Date.now() + b.snooze_days * 864e5).toISOString();
    settings.notify_snooze = { ...(settings.notify_snooze ?? {}), [b.kind]: until };
  } else if (typeof b?.enabled === "boolean") {
    settings.notify_rules = { ...(settings.notify_rules ?? {}), [b.kind]: b.enabled };
    if (b.enabled && settings.notify_snooze) {
      const { [b.kind]: _, ...rest } = settings.notify_snooze;
      settings.notify_snooze = rest;
    }
  } else {
    return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  }
  const { error } = await admin.from("tenants").update({ settings }).eq("id", res.ctx.tenantId);
  if (error) return NextResponse.json({ ok: false, error: "db" }, { status: 500 });
  return NextResponse.json({ ok: true, kind: b.kind });
}
