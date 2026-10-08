import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";

/** GET /api/onboarding — حالة خطوات التفعيل الأربع (مالك فقط) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const { data: t } = await admin.from("tenants").select("slug,settings").eq("id", tid).single();
  if ((t as any)?.settings?.onboarding_dismissed) {
    return NextResponse.json({ ok: true, dismissed: true, steps: [] });
  }
  const [{ count: g }, { count: st }, { count: ex }, { count: pay }] = await Promise.all([
    admin.from("groups").select("id", { count: "exact", head: true }).eq("tenant_id", tid),
    admin.from("users").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("role", "student"),
    admin.from("exams").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("is_published", true),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "confirmed"),
  ]);
  const steps = [
    { key: "group", title: "أنشئ مجموعتك الأولى", desc: "مجموعة واحدة تكفي للبدء", done: (g ?? 0) > 0, href: "/dashboard/groups" },
    { key: "students", title: "أضف 3 طلاب", desc: "بالاسم ورقم الموبايل", done: (st ?? 0) >= 3, href: "/dashboard/students", progress: `${Math.min(st ?? 0, 3)}/3` },
    { key: "exam", title: "ولّد وانشر أول امتحان", desc: "من بنك أسئلتك بضغطة", done: (ex ?? 0) > 0, href: "/dashboard/exams" },
    { key: "payment", title: "سجّل أول تحصيل", desc: "أول دفعة تقفل خزنتك", done: (pay ?? 0) > 0, href: "/dashboard/payments" },
    { key: "site", title: "عاين موقع سنترك العام", desc: "شوف اللي هيشوفه الطالب", done: (t as any)?.settings?.site_preview_confirmed === true, href: `/${(t as any)?.slug ?? ""}` },
  ];
  return NextResponse.json({ ok: true, dismissed: false, steps, done: steps.filter((s) => s.done).length });
}

/** POST /api/onboarding {dismiss:true} — إخفاء القائمة نهائياً | {confirm:"site"} — تأكيد معاينة الموقع */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const body = await req.json().catch(() => ({} as any));
  const { data: t } = await admin.from("tenants").select("settings").eq("id", res.ctx.tenantId).single();
  const settings = { ...(((t as any)?.settings ?? {}) as object) };
  if (body?.dismiss === true) {
    (settings as any).onboarding_dismissed = true;
  } else if (body?.confirm === "site") {
    (settings as any).site_preview_confirmed = true;
  } else {
    return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
  }
  await admin.from("tenants").update({ settings }).eq("id", res.ctx.tenantId);
  return NextResponse.json({ ok: true });
}
