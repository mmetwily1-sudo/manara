import { NextResponse } from "next/server";
import { R } from "@/lib/permissions";

/**
 * DELETE /api/exams/[id]/source-images — حذف صور المسح الأصلية لامتحان.
 * الأسئلة النصية المعتمدة تبقى؛ الصور كانت مرجع مراجعة فقط.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;

  const { data: exam } = await admin.from("exams").select("id").eq("id", params.id).eq("tenant_id", tid).single();
  if (!exam) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const { data: qs } = await admin
    .from("questions")
    .select("source_detail")
    .eq("tenant_id", tid)
    .like("source_detail", `%${params.id}%`)
    .limit(200);
  const refs = new Set<string>();
  for (const q of (qs ?? []) as any[]) {
    try {
      const m = JSON.parse(q.source_detail ?? "{}");
      if (m.ref && m.exam_id === params.id) refs.add(m.ref);
    } catch {}
  }
  let removed = 0;
  for (const ref of Array.from(refs)) {
    const prefix = `scans/${tid}/${ref}`;
    const { data: files } = await admin.storage.from("exam-pages").list(prefix);
    if (files?.length) {
      const { error } = await admin.storage.from("exam-pages").remove(
        files.map((f: any) => `${prefix}/${f.name}`)
      );
      if (!error) removed += files.length;
    }
  }
  return NextResponse.json({ ok: true, removed });
}
