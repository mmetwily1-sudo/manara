import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";

/** POST /api/assignments/[id]/remind — تذكير push لمن لم يسلّم (معلم) */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const res = await requireTeacher(R.content, { req: _req });
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const { data: a } = await admin.from("assignments").select("id,title,group_id")
    .eq("id", params.id).eq("tenant_id", tid).single();
  if (!a) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const [{ data: enr }, { data: subs }] = await Promise.all([
    admin.from("enrollments").select("student_id").eq("tenant_id", tid)
      .eq("group_id", (a as any).group_id).eq("status", "active").limit(500),
    admin.from("submissions").select("student_id").eq("tenant_id", tid).eq("assignment_id", params.id).limit(1000),
  ]);
  const done = new Set(((subs ?? []) as any[]).map((s) => s.student_id));
  const pending = ((enr ?? []) as any[]).map((e) => e.student_id).filter((id) => !done.has(id));
  let pushed = 0;
  try {
    const { sendPushToUser } = await import("@/lib/push");
    for (const sid of pending.slice(0, 100)) {
      const r = await sendPushToUser(admin, tid, sid, {
        title: "واجب بانتظارك 📝", body: `«${(a as any).title}» — سلّمه قبل الموعد`, url: "/progress",
      });
      pushed += r.sent;
    }
  } catch {}
  return NextResponse.json({ ok: true, pending: pending.length, pushed });
}
