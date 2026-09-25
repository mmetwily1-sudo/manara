import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { isRateLimited } from "@/lib/rate-limit";

/**
 * POST /api/questions/generate {text, subject?, count?, lesson_code?}
 * محرك أسئلة من المذكرات: استخراج → مسودات للمراجعة (لا نشر تلقائي).
 */
export async function POST(req: Request) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  if (isRateLimited(req, "qgen", 20, 60 * 60 * 1000, res.ctx.tenantId)) {
    return NextResponse.json({ ok: false, error: "too_many_attempts", message: "تجاوزت حد التوليد (20/ساعة)." }, { status: 429 });
  }
  const admin = res.ctx.admin;
  const body = await req.json().catch(() => ({} as any));

  try {
    const { data: trow } = await admin.from("tenants").select("settings").eq("id", res.ctx.tenantId).single();
    const { visionChain } = await import("@/lib/vision");
    const keys = visionChain(
      (trow as any)?.settings?.vision_key ?? null,
      (trow as any)?.settings?.vision_key_2 ?? null
    );
    const { generateFromNotes } = await import("@/mastra/tool-impls");
    const out = (await generateFromNotes(admin, res.ctx.tenantId, {
      text: String(body?.text ?? ""),
      subject: String(body?.subject ?? ""),
      count: Number(body?.count ?? 5),
      lesson_code: String(body?.lesson_code ?? ""),
    }, { keys })) as any;
    if (out?.error) return NextResponse.json({ ok: false, error: out.error, message: out.message ?? "" }, { status: 400 });
    try {
      await admin.from("audit_log").insert({
        tenant_id: res.ctx.tenantId, actor_id: res.ctx.userRow.id,
        action: "questions:generate_notes", entity_type: "question", entity_id: "bulk",
        details: { drafts: out.drafts, subject: out.subject },
      });
    } catch {}
    return NextResponse.json({ ok: true, ...out });
  } catch (e: any) {
    return dbFail("qgen", e);
  }
}
