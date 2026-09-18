import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/server-auth";
import { suggestLessons } from "@/lib/suggest-lesson";

/**
 * GET /api/admin/bank/suggest?trackCode=moe-3sec-sci&subject=فيزياء
 * أسئلة مشتركة معتمدة بلا ربط درس + أفضل 3 اقتراحات لكل سؤال (مع الدليل).
 * القرار النهائي بشري عبر POST /api/admin/bank/link.
 */
export async function GET(req: Request) {
  const g = await requirePlatformAdmin();
  if ("error" in g) return g.error;
  const admin = g.ctx.admin;

  const sp = new URL(req.url).searchParams;
  const trackCode = sp.get("trackCode") ?? "";
  const subject = sp.get("subject") ?? "";
  if (!trackCode || !subject) {
    return NextResponse.json({ ok: false, error: "trackCode+subject required" }, { status: 400 });
  }

  const { data: track } = await admin
    .from("curriculum_tracks").select("id").eq("code", trackCode).single();
  if (!track) return NextResponse.json({ ok: false, error: "track_not_found" }, { status: 404 });

  const limit = Math.min(Number(sp.get("limit") ?? 30) || 30, 200);
  const offset = Math.max(Number(sp.get("offset") ?? 0) || 0, 0);
  const [{ data: lessons }, { data: questions }, { data: totalRow }] = await Promise.all([
    admin
      .from("curriculum_lessons")
      .select("code,lesson_title,unit_title")
      .eq("track_id", (track as any).id)
      .eq("subject", subject)
      .order("unit_no", { ascending: true })
      .order("lesson_no", { ascending: true }),
    admin
      .from("questions")
      .select("id,body,options,subject")
      .is("tenant_id", null)
      .eq("visibility", "shared")
      .eq("status", "approved")
      .eq("subject", subject)
      .is("lesson_code", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1),
    admin
      .from("questions")
      .select("id", { count: "exact", head: true })
      .is("tenant_id", null)
      .eq("visibility", "shared")
      .eq("status", "approved")
      .eq("subject", subject)
      .is("lesson_code", null),
  ]);

  const ls = (lessons ?? []) as any[];
  // احتياطي عبر المسارات: نفس المادة في مسارات أخرى (يُعلَّم باسم المسار)
  let cross: any[] = [];
  try {
    const { data: cl } = await admin
      .from("curriculum_lessons")
      .select("code,lesson_title,unit_title,track_id")
      .eq("subject", subject)
      .neq("track_id", (track as any).id)
      .limit(400);
    const { data: ts } = await admin.from("curriculum_tracks").select("id,grade_ar,stream_ar,term");
    const label: Record<string, string> = {};
    for (const t of (ts ?? []) as any[]) label[t.id] = `${t.grade_ar}${t.stream_ar ? " " + t.stream_ar : ""} ت${t.term}`;
    cross = ((cl ?? []) as any[]).map((l) => ({ ...l, track_label: label[l.track_id] ?? "" }));
  } catch {}
  const out = ((questions ?? []) as any[]).map((q) => {
    const text = `${q.body} ${(q.options ?? []).join(" ")}`;
    let sug: any[] = suggestLessons(text, ls, 3).map((s) => ({ ...s, other_track: false }));
    if (!sug.length && cross.length) {
      sug = suggestLessons(text, cross, 3).map((s) => ({ ...s, other_track: true }));
    }
    return { id: q.id, body: q.body, subject: q.subject, suggestions: sug };
  });

  return NextResponse.json({
    ok: true,
    lessons: ls.map((l) => ({ code: l.code, title: `${l.unit_title} — ${l.lesson_title}` })),
    questions: out,
    unmappedTotal: totalRow ?? out.length,
  });
}
