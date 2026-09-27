import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { dbFail } from "@/lib/api-error";

/**
 * POST /api/students/import {rows:[{name, phone?, group_id?}]} — استيراد طلاب بالجملة (مالك فقط).
 * يتخطى المكرر (نفس الهاتف داخل السنتر) ويلحق بالمجموعة إن وُجدت.
 */
export async function POST(req: Request) {
  const res = await requireTeacher(R.studentsWrite);
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const b = await req.json().catch(() => ({} as any));
  const rows = Array.isArray(b?.rows) ? b.rows.slice(0, 500) : [];
  if (!rows.length) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });

  const { data: existing } = await sb.from("users").select("phone").eq("tenant_id", tid).eq("role", "student").limit(5000);
  const phones = new Set(((existing ?? []) as any[]).map((u) => String(u.phone ?? "").replace(/[^\d]/g, "")).filter(Boolean));

  let imported = 0, skipped = 0;
  const bad: string[] = [];
  for (const r of rows) {
    const name = String(r?.name ?? "").trim().slice(0, 120);
    const phone = String(r?.phone ?? "").replace(/[^\d]/g, "").slice(0, 20) || null;
    if (!name) continue;
    if (phone && phones.has(phone)) { skipped++; continue; }
    try {
      let groupId: string | null = null;
      if (r?.group_id) {
        const { data: g } = await sb.from("groups").select("id").eq("id", r.group_id).eq("tenant_id", tid).single();
        if (g) groupId = (g as any).id;
      }
      const { data: row, error } = await sb.from("users").insert({
        tenant_id: tid, auth_user_id: null, role: "student", full_name: name, phone,
      }).select("id").single();
      if (error || !row) { bad.push(name); continue; }
      if (groupId) {
        await sb.from("enrollments").insert({ tenant_id: tid, student_id: (row as any).id, group_id: groupId, status: "active" });
      }
      if (phone) phones.add(phone);
      imported++;
    } catch { if (bad.length < 20) bad.push(name); }
  }
  try {
    await sb.from("audit_log").insert({
      tenant_id: tid, actor_id: res.ctx.userRow.id,
      action: "students:import", entity_type: "student", entity_id: "bulk", details: { imported, skipped },
    });
  } catch {}
  return NextResponse.json({ ok: true, imported, skipped, bad });
}
