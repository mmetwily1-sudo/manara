import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { getSessionUser, adminClient } from "@/lib/server-auth";

async function me() {
  const user = await getSessionUser();
  if (!user) return null;
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role,full_name,points")
    .eq("auth_user_id", user.id).single();
  if (!urow) return null;
  return { admin, urow: urow as any };
}

/** GET /api/points/rewards — المكافآت (طالب: النشطة + رصيدي، معلم: الكل + الاستبدالات) */
export async function GET() {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const { admin, urow } = m;
  const tid = urow.tenant_id;
  const isTeacher = urow.role !== "student";
  let q = admin.from("point_rewards").select("id,title,cost_points,stock,active")
    .eq("tenant_id", tid).order("cost_points", { ascending: true }).limit(100);
  if (!isTeacher) q = q.eq("active", true);
  const { data: rewards, error } = await q;
  if (error) return dbFail("rewards-list", error);
  const out: any = { ok: true, isTeacher, balance: Number(urow.points ?? 0) || 0, rewards: rewards ?? [] };
  if (isTeacher) {
    const { data: reds } = await admin.from("point_redemptions").select("id,reward_id,student_id,status,created_at")
      .eq("tenant_id", tid).order("created_at", { ascending: false }).limit(200);
    const sids = Array.from(new Set(((reds ?? []) as any[]).map((r) => r.student_id)));
    const rids = Array.from(new Set(((reds ?? []) as any[]).map((r) => r.reward_id)));
    let names: Record<string, string> = {};
    let titles: Record<string, string> = {};
    if (sids.length) {
      const { data: us } = await admin.from("users").select("id,full_name").in("id", sids as string[]);
      (us ?? []).forEach((u: any) => { names[u.id] = u.full_name ?? ""; });
    }
    if (rids.length) {
      const { data: rw } = await admin.from("point_rewards").select("id,title").in("id", rids as string[]);
      (rw ?? []).forEach((r: any) => { titles[r.id] = r.title ?? ""; });
    }
    out.redemptions = ((reds ?? []) as any[]).map((r) => ({
      ...r, student: names[r.student_id] ?? "", title: titles[r.reward_id] ?? "",
    }));
  } else {
    const { data: mine } = await admin.from("point_redemptions").select("id,reward_id,status,created_at")
      .eq("tenant_id", tid).eq("student_id", urow.id).order("created_at", { ascending: false }).limit(50);
    out.mine = mine ?? [];
  }
  return NextResponse.json(out);
}

/** POST /api/points/rewards — معلم: مكافأة جديدة | طالب: استبدال {reward_id} */
export async function POST(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const { admin, urow } = m;
  const tid = urow.tenant_id;
  const isTeacher = urow.role !== "student";
  const b = await req.json().catch(() => ({} as any));
  if (isTeacher) {
    const cost = Number(b?.cost_points ?? NaN);
    if (!String(b?.title ?? "").trim() || !(cost > 0)) {
      return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
    }
    const { error } = await admin.from("point_rewards").insert({
      tenant_id: tid, title: String(b.title).slice(0, 120), cost_points: cost,
      stock: b?.stock === undefined || b?.stock === "" ? -1 : Math.max(-1, Number(b.stock ?? -1)),
    });
    if (error) return dbFail("reward-create", error);
    return NextResponse.json({ ok: true });
  }
  const { data: rw } = await admin.from("point_rewards").select("id,cost_points,stock,active")
    .eq("id", b?.reward_id).eq("tenant_id", tid).single();
  if (!rw || !(rw as any).active) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const cost = Number((rw as any).cost_points ?? 0);
  const balance = Number(urow.points ?? 0) || 0;
  if (balance < cost) return NextResponse.json({ ok: false, error: "no_balance" }, { status: 400 });
  if (Number((rw as any).stock ?? -1) === 0) return NextResponse.json({ ok: false, error: "out_of_stock" }, { status: 400 });
  const { error: ue } = await admin.from("users").update({ points: balance - cost }).eq("id", urow.id).eq("tenant_id", tid);
  if (ue) return dbFail("redeem-balance", ue);
  if (Number((rw as any).stock ?? -1) > 0) {
    await admin.from("point_rewards").update({ stock: Number((rw as any).stock) - 1 }).eq("id", (rw as any).id);
  }
  const { error: re } = await admin.from("point_redemptions").insert({
    tenant_id: tid, reward_id: (rw as any).id, student_id: urow.id,
  });
  if (re) return dbFail("redeem-create", re);
  return NextResponse.json({ ok: true, balance: balance - cost });
}

/** PATCH /api/points/rewards {id?, redemption_id?, active?} — تفعيل/إيقاف مكافأة أو تسليم استبدال (معلم) */
export async function PATCH(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  if (m.urow.role === "student") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { admin, urow } = m;
  const b = await req.json().catch(() => ({} as any));
  if (b?.redemption_id) {
    const { error } = await admin.from("point_redemptions").update({ status: "delivered" })
      .eq("id", b.redemption_id).eq("tenant_id", urow.tenant_id);
    if (error) return dbFail("redeem-deliver", error);
    return NextResponse.json({ ok: true });
  }
  if (b?.id) {
    const { error } = await admin.from("point_rewards").update({ active: !!b.active })
      .eq("id", b.id).eq("tenant_id", urow.tenant_id);
    if (error) return dbFail("reward-toggle", error);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
}
