import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** GET /api/digests — أحدث تقارير أولياء الأمور (مالك + مشرف) */
export async function GET() {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const { data } = await admin.from("parent_digests")
    .select("id,student_id,period,payload,wa_text,created_at")
    .eq("tenant_id", res.ctx.tenantId).order("created_at", { ascending: false }).limit(200);
  const sids = Array.from(new Set((data ?? []).map((d: any) => d.student_id)));
  let people: Record<string, { name: string; phone: string | null }> = {};
  if (sids.length) {
    const { data: st } = await admin.from("users").select("id,full_name,phone").in("id", sids as string[]);
    (st ?? []).forEach((s: any) => { people[s.id] = { name: s.full_name, phone: s.phone ?? null }; });
  }
  return NextResponse.json({
    ok: true,
    digests: (data ?? []).map((d: any) => ({
      id: d.id, period: d.period, payload: d.payload, wa_text: d.wa_text, created_at: d.created_at,
      student: people[d.student_id]?.name ?? "—", phone: people[d.student_id]?.phone ?? null,
    })),
  });
}

/** POST /api/digests {period?} — توليد تقارير الأسبوع يدوياً (مالك + مشرف) */
export async function POST(req: Request) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  try {
    const { buildDigest } = await import("@/lib/digest");
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const period = since.toISOString().slice(0, 10);
    const { data: students } = await admin.from("users").select("id")
      .eq("tenant_id", tid).eq("role", "student").limit(300);
    let created = 0;
    for (const s of (students ?? []) as any[]) {
      const d = await buildDigest(admin, tid, s.id);
      const { error } = await admin.from("parent_digests").insert({
        tenant_id: tid, student_id: s.id, period, payload: d, wa_text: d.wa_text,
      });
      if (!error) {
        created++;
        // push فوري للمشتركين (best-effort)
        try {
          const { sendPushToUser } = await import("@/lib/push");
          await sendPushToUser(admin, tid, s.id, {
            title: `التقرير الأسبوعي 📊`, body: `حضور ${d.present} · غياب ${d.absent}${d.due > 0 ? ` · مستحق ${d.due} ج` : ""}`, url: "/progress",
          });
        } catch {}
      }
    }
    return NextResponse.json({ ok: true, created, period });
  } catch (e: any) {
    return dbFail("digests", e);
  }
}
