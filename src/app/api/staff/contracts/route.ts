import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";

const KINDS = ["monthly", "per_session", "commission"] as const;
const KIND_LABEL: Record<string, string> = { monthly: "شهري", per_session: "بالحصة", commission: "عمولة" };

/** GET /api/staff/contracts — عقود الموظفين النشطة (مالك فقط) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const { data: contracts, error } = await admin.from("staff_contracts")
    .select("id,user_id,salary_base,kind,start_date,end_date,active,created_at")
    .eq("tenant_id", tid).eq("active", true).order("created_at", { ascending: false }).limit(200);
  if (error) return dbFail("contracts-list", error);
  const uids = Array.from(new Set(((contracts ?? []) as any[]).map((c) => c.user_id)));
  let names: Record<string, string> = {};
  if (uids.length) {
    const { data: us } = await admin.from("users").select("id,full_name").in("id", uids as string[]);
    (us ?? []).forEach((u: any) => { names[u.id] = u.full_name ?? ""; });
  }
  return NextResponse.json({
    ok: true,
    contracts: ((contracts ?? []) as any[]).map((c) => ({
      id: c.id, user_id: c.user_id, name: names[c.user_id] ?? "",
      salary_base: Number(c.salary_base ?? 0), kind: c.kind,
      kind_label: KIND_LABEL[c.kind] ?? c.kind,
      start_date: c.start_date, end_date: c.end_date,
    })),
  });
}

/** POST /api/staff/contracts {user_id, salary_base, kind, start_date?, end_date?} — عقد جديد (يثبت السابق) */
export async function POST(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const userId = String(b?.user_id ?? "");
  const salary = Number(b?.salary_base ?? NaN);
  const kind = String(b?.kind ?? "monthly");
  if (!userId || !(salary >= 0) || !(KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
  }
  const { data: target } = await admin.from("users").select("id").eq("id", userId).eq("tenant_id", tid).single();
  if (!target) return NextResponse.json({ ok: false, error: "bad_user" }, { status: 400 });
  await admin.from("staff_contracts").update({ active: false }).eq("tenant_id", tid).eq("user_id", userId).eq("active", true);
  const { error } = await admin.from("staff_contracts").insert({
    tenant_id: tid, user_id: userId, salary_base: salary, kind,
    start_date: b?.start_date || new Date().toISOString().slice(0, 10),
    end_date: b?.end_date || null,
  });
  if (error) return dbFail("contract-create", error);
  return NextResponse.json({ ok: true });
}

/** PATCH /api/staff/contracts {id} — إنهاء عقد (مالك فقط) */
export async function PATCH(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!b?.id) return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  const { error } = await res.ctx.admin.from("staff_contracts").update({ active: false })
    .eq("id", b.id).eq("tenant_id", res.ctx.tenantId);
  if (error) return dbFail("contract-end", error);
  return NextResponse.json({ ok: true });
}
