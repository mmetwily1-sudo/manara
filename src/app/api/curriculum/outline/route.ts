import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";

/**
 * GET /api/curriculum/outline?trackCode=moe-3sec-sci&subject=فيزياء
 * مفردات مادة: وحدات ← دروس (بالأوزان) + الكتب الخارجية + عدد أسئلة البنك لكل درس
 */
export async function GET(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const sp = new URL(req.url).searchParams;
  const trackCode = sp.get("trackCode") ?? "";
  const subject = sp.get("subject") ?? "";
  if (!trackCode) return NextResponse.json({ ok: false, error: "trackCode_required" }, { status: 400 });

  const { data: track, error: tErr } = await admin
    .from("curriculum_tracks").select("id,grade_ar,stream_ar").eq("code", trackCode).single();
  if ((tErr as any)?.code === "42P01") {
    return NextResponse.json({ ok: false, error: "curriculum_not_ready", message: "طبقة المنهج غير منشأة بعد — نفّذ ترحيل 004" }, { status: 500 });
  }
  if (tErr || !track) {
    return NextResponse.json({ ok: false, error: "track_not_found" }, { status: 404 });
  }
  const tid = (track as any).id;

  let subjects: string[];
  if (subject) {
    subjects = [subject];
  } else {
    const { data: rows } = await admin
      .from("curriculum_lessons").select("subject").eq("track_id", tid);
    subjects = Array.from(new Set((rows ?? []).map((r: any) => r.subject as string)));
  }

  const [lessonsRes, booksRes, countsRes] = await Promise.all([
    admin
      .from("curriculum_lessons")
      .select("subject,unit_no,unit_title,lesson_no,lesson_title,code,weight")
      .eq("track_id", tid)
      .in("subject", subjects.length ? subjects : ["__none__"])
      .order("unit_no", { ascending: true })
      .order("lesson_no", { ascending: true }),
    admin
      .from("curriculum_books")
      .select("id,subject,name")
      .eq("track_id", tid)
      .in("subject", subjects.length ? subjects : ["__none__"])
      .order("name", { ascending: true }),
    admin
      .from("questions")
      .select("lesson_code")
      .eq("tenant_id", res.ctx.tenantId)
      .not("lesson_code", "is", null)
      .limit(5000),
  ]);

  const bankCounts: Record<string, number> = {};
  for (const q of (countsRes.data ?? []) as any[]) {
    if (q.lesson_code) bankCounts[q.lesson_code] = (bankCounts[q.lesson_code] ?? 0) + 1;
  }

  // تجميع الدروس تحت وحداتها
  const units: Record<string, { subject: string; unit_no: number; unit_title: string; lessons: any[] }> = {};
  for (const l of (lessonsRes.data ?? []) as any[]) {
    const key = `${l.subject}|${l.unit_no}`;
    if (!units[key]) units[key] = { subject: l.subject, unit_no: l.unit_no, unit_title: l.unit_title, lessons: [] };
    units[key].lessons.push({ ...l, bank_count: bankCounts[l.code] ?? 0 });
  }

  return NextResponse.json({
    ok: true,
    track: { code: trackCode, grade: (track as any).grade_ar, stream: (track as any).stream_ar },
    subjects,
    units: Object.values(units),
    books: booksRes.data ?? [],
  });
}
