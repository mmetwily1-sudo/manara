import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** GET /api/team/presence — حضور الموظفين (اليوم + الشهر) */
export async function GET() {
  const res = await requireTeacher(R.feedback);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const isOwner = res.ctx.userRow.role === "teacher_admin";
  let q = admin.from("staff_presence").select("id,user_id,work_date,check_in,check_out,users(full_name)")
    .eq("tenant_id", tid).order("work_date", { ascending: false }).limit(200);
  if (!isOwner) q = q.eq("user_id", res.ctx.userRow.id);
  const { data } = await q;
  const mine = ((data ?? []) as any[]).find((p) => p.user_id === res.ctx.userRow.id && p.work_date === today) ?? null;
  const monthCount = ((data ?? []) as any[]).filter((p) => String(p.work_date ?? "").startsWith(month) && p.check_in).length;
  return NextResponse.json({ ok: true, isOwner, mine, monthCount, rows: data ?? [] });
}

/** POST /api/team/presence {action:"in"|"out"} — تسجيل دخول/خروج (طاقم) */
export async function POST(req: Request) {
  const res = await requireTeacher(R.feedback, { req: req });
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  if (!["in", "out"].includes(b?.action)) return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  try {
    if (b.action === "in") {
      // دخول واحد يومياً — الموجود يُبقى (لا تصفير للخروج)
      const { data: prev } = await admin.from("staff_presence").select("id,check_in").eq("tenant_id", tid)
        .eq("user_id", res.ctx.userRow.id).eq("work_date", today).single();
      if (!(prev as any)?.check_in) {
        const { error } = await admin.from("staff_presence").upsert({
          tenant_id: tid, user_id: res.ctx.userRow.id, work_date: today, check_in: now,
        }, { onConflict: "tenant_id,user_id,work_date" });
        if (error) throw error;
      }
    } else {
      const { data: row } = await admin.from("staff_presence").select("id").eq("tenant_id", tid)
        .eq("user_id", res.ctx.userRow.id).eq("work_date", today).single();
      if (!row) return NextResponse.json({ ok: false, error: "no_checkin" }, { status: 400 });
      await admin.from("staff_presence").update({ check_out: now }).eq("id", (row as any).id);
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return dbFail("presence", e);
  }
}
