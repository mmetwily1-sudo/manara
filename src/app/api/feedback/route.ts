import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** POST /api/feedback {kind: nps|idea|bug|praise|survey, score?, text?, page?} — صوت المعلم */
export async function POST(req: Request) {
  const res = await requireTeacher(R.feedback);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;

  const body = await req.json().catch(() => ({} as any));
  const kind = String(body?.kind ?? "idea");
  if (!["nps", "idea", "bug", "praise", "survey"].includes(kind)) {
    return NextResponse.json({ ok: false, error: "bad_kind" }, { status: 400 });
  }
  const score = body?.score == null ? null : Math.max(1, Math.min(10, Number(body.score) || 0)) || null;
  const text = String(body?.text ?? "").trim().slice(0, 2000);
  const page = String(body?.page ?? "").trim().slice(0, 120) || null;
  if (kind === "nps" && score === null) {
    return NextResponse.json({ ok: false, error: "need_score" }, { status: 400 });
  }
  if (kind !== "nps" && !text) {
    return NextResponse.json({ ok: false, error: "need_text" }, { status: 400 });
  }
  // حد ناعم: 20/يوم لكل سنتر ضد الإغراق
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin.from("feedback").select("id", { count: "exact", head: true })
    .eq("tenant_id", res.ctx.tenantId).gte("created_at", dayAgo);
  if ((count ?? 0) >= 20) return NextResponse.json({ ok: false, error: "too_many" }, { status: 429 });

  const { error } = await admin.from("feedback").insert({
    tenant_id: res.ctx.tenantId, user_id: res.ctx.userRow.id, kind, score, text, page,
  });
  if (error) return dbFail("feedback", error);
  // NPS منخفض (≤6): تذكرة متابعة تلقائية — الملاحظة تتحول لإجراء (قرار اللجنة)
  if (kind === "nps" && score !== null && score <= 6) {
    try {
      await admin.from("support_tickets").insert({
        tenant_id: res.ctx.tenantId, opened_by: res.ctx.userRow.id, category: "nps_followup",
        subject: `متابعة NPS منخفض (${score}/10)`, body: text || "بدون تفاصيل — تواصل مع المعلم.",
        priority: "high", status: "open",
      });
    } catch {}
  }
  // حملة NPS: سجّل تاريخ السؤال (مرة كل 90 يوماً)
  if (kind === "nps") {
    try {
      const { data: t } = await admin.from("tenants").select("settings").eq("id", res.ctx.tenantId).single();
      await admin.from("tenants").update({
        settings: { ...(((t as any)?.settings ?? {}) as object), nps_last_asked: new Date().toISOString() },
      }).eq("id", res.ctx.tenantId);
    } catch {}
  }
  return NextResponse.json({ ok: true });
}
