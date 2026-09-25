import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** POST /api/feedback {kind: nps|idea|bug|praise, score?, text?, page?} — صوت المعلم */
export async function POST(req: Request) {
  const res = await requireTeacher(R.feedback);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;

  const body = await req.json().catch(() => ({} as any));
  const kind = String(body?.kind ?? "idea");
  if (!["nps", "idea", "bug", "praise"].includes(kind)) {
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
  return NextResponse.json({ ok: true });
}
