import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/** GET /api/students/[id]/behavior — سجل السلوك + مستوى الإنذار + الإيقاف */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const [{ data: notes }, { data: st }] = await Promise.all([
    admin.from("behavior_notes").select("id,kind,text,created_at").eq("tenant_id", tid).eq("student_id", params.id)
      .order("created_at", { ascending: false }).limit(50),
    admin.from("users").select("suspended_until").eq("id", params.id).eq("tenant_id", tid).single(),
  ]);
  const neg = ((notes ?? []) as any[]).filter((n) => n.kind === "negative").length;
  const level = neg === 0 ? null : neg <= 2 ? "شفهي 🟡" : neg <= 4 ? "كتابي 🟠" : "نهائي 🔴";
  return NextResponse.json({
    ok: true, notes: notes ?? [], negatives: neg, level,
    suspended_until: (st as any)?.suspended_until ?? null,
  });
}

/** POST /api/students/[id]/behavior {kind, text} — ملاحظة سلوكية */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!["positive", "negative"].includes(b?.kind) || !String(b?.text ?? "").trim()) {
    return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  }
  const { data: st } = await res.ctx.admin.from("users").select("id").eq("id", params.id)
    .eq("tenant_id", res.ctx.tenantId).eq("role", "student").single();
  if (!st) return NextResponse.json({ ok: false, error: "bad_student" }, { status: 400 });
  const { error } = await res.ctx.admin.from("behavior_notes").insert({
    tenant_id: res.ctx.tenantId, student_id: params.id,
    kind: b.kind, text: String(b.text).trim().slice(0, 500), created_by: res.ctx.userRow.id,
  });
  if (error) return dbFail("behavior", error);
  return NextResponse.json({ ok: true });
}
