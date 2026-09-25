import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requirePlatformAdmin } from "@/lib/server-auth";

/** GET /api/admin/winback — تجارب منتهية لكن نشطة (مرشحو الاسترداد) */
export async function GET() {
  const res = await requirePlatformAdmin();
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  try {
    const { data: expired } = await admin.from("tenants")
      .select("id,name,slug,plan,trial_ends_at,settings,created_at")
      .eq("status", "active").eq("plan", "trial")
      .lt("trial_ends_at", new Date().toISOString())
      .order("trial_ends_at", { ascending: false }).limit(100);
    const real = (expired ?? []).filter((t: any) => !(t.settings as any)?.is_demo);
    const out: any[] = [];
    for (const t of real as any[]) {
      const [{ count: users }, { count: pay }, { count: ex }, { count: qs }] = await Promise.all([
        admin.from("users").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
        admin.from("payments").select("id", { count: "exact", head: true }).eq("tenant_id", t.id).eq("status", "confirmed"),
        admin.from("exams").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
        admin.from("questions").select("id", { count: "exact", head: true }).eq("tenant_id", t.id).eq("status", "approved"),
      ]);
      const activity = (users ?? 0) + (pay ?? 0) + (ex ?? 0) + (qs ?? 0);
      if (activity === 0) continue;
      out.push({
        id: t.id, name: t.name, slug: t.slug,
        expired_since: t.trial_ends_at,
        owner_phone: t.settings?.owner_phone ?? null,
        users, payments: pay, exams: ex, questions: qs, score: activity,
      });
    }
    out.sort((a, b) => b.score - a.score);
    return NextResponse.json({ ok: true, candidates: out });
  } catch (e: any) {
    return dbFail("winback", e);
  }
}

/** POST /api/admin/winback {id, days?} — تمديد عرض العودة (افتراضي 7 أيام) */
export async function POST(req: Request) {
  const res = await requirePlatformAdmin();
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const body = await req.json().catch(() => ({} as any));
  const id = String(body?.id ?? "");
  const days = Math.max(1, Math.min(30, Number(body?.days ?? 7) || 7));
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  const { data: t } = await admin.from("tenants").select("trial_ends_at,settings").eq("id", id).single();
  if (!t) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const base = Math.max(Date.now(), new Date((t as any).trial_ends_at ?? 0).getTime() || 0);
  const extended = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin.from("tenants").update({ trial_ends_at: extended, status: "active" }).eq("id", id);
  if (error) return dbFail("winback-extend", error);
  try {
    await admin.from("audit_log").insert({
      tenant_id: id, actor_id: res.ctx.adminId,
      action: "admin:trial_extend", entity_type: "tenant", entity_id: id, details: { days },
    });
  } catch {}
  return NextResponse.json({ ok: true, trial_ends_at: extended });
}
