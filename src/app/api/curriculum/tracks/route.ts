import { NextResponse } from "next/server";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";
import { requireTeacher, isMissingTable } from "@/lib/server-auth";

/** GET /api/curriculum/tracks — المسارات الدراسية النشطة (عام/أزهر) */
export async function GET() {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const { data, error } = await res.ctx.admin
    .from("curriculum_tracks")
    .select("code,system,grade_ar,stream_ar,term,year")
    .eq("is_active", true)
    .order("system", { ascending: true })
    .order("grade_ar", { ascending: true });
  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ ok: false, error: "curriculum_not_ready", message: "طبقة المنهج غير منشأة بعد — نفّذ ترحيل 004" }, { status: 500 });
    }
    return dbFail("curriculum-tracks", error);
  }
  return NextResponse.json({ ok: true, tracks: data ?? [] });
}
