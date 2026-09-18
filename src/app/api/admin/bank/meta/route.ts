import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/server-auth";

/** GET /api/admin/bank/meta — المسارات مع موادها (لواجهة الربط) */
export async function GET() {
  const g = await requirePlatformAdmin();
  if ("error" in g) return g.error;
  const admin = g.ctx.admin;

  const { data: tracks } = await admin
    .from("curriculum_tracks")
    .select("code,system,grade_ar,stream_ar,term")
    .eq("is_active", true)
    .order("system", { ascending: true });
  const { data: pairs } = await admin
    .from("curriculum_lessons")
    .select("track_id,subject")
    .limit(5000);
  const { data: trackIds } = await admin.from("curriculum_tracks").select("id,code").limit(200);
  const codeOf: Record<string, string> = {};
  for (const t of (trackIds ?? []) as any[]) codeOf[t.id] = t.code;
  const subjectsOf: Record<string, string[]> = {};
  for (const p of (pairs ?? []) as any[]) {
    const c = codeOf[p.track_id];
    if (!c) continue;
    if (!subjectsOf[c]) subjectsOf[c] = [];
    if (!subjectsOf[c].includes(p.subject)) subjectsOf[c].push(p.subject);
  }
  return NextResponse.json({
    ok: true,
    tracks: ((tracks ?? []) as any[]).map((t) => ({
      code: t.code,
      label: `${t.system === "azhar" ? "أزهر" : "عام"} · ${t.grade_ar}${t.stream_ar ? ` · ${t.stream_ar}` : ""} · ت${t.term}`,
      subjects: subjectsOf[t.code] ?? [],
    })),
  });
}
