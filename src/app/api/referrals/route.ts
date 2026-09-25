import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";

function makeCode(slug: string): string {
  const clean = slug.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 10) || "CENTER";
  const rnd = randomBytes(2).toString("hex").toUpperCase();
  return `${clean}-${rnd}`;
}

/** GET /api/referrals — كودي + رابطي + إحصائياتي + قائمتي (معلم فقط) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;

  // كود الإحالة الخاص بالسنتر (يُنشأ مرة واحدة ويُعاد استخدامه)
  let { data: mine } = await admin.from("referrals").select("code")
    .eq("referrer_tenant_id", tid).is("referee_tenant_id", null).order("created_at", { ascending: true }).limit(1).single();
  if (!mine) {
    const { data: t } = await admin.from("tenants").select("slug").eq("id", tid).single();
    let code = "";
    for (let i = 0; i < 5; i++) {
      code = makeCode((t as any)?.slug ?? "");
      const { data: clash } = await admin.from("referrals").select("id").eq("code", code).limit(1);
      if (!clash?.length) break;
    }
    const { data: ins, error } = await admin.from("referrals")
      .insert({ referrer_tenant_id: tid, code }).select("code").single();
    if (error) {
      // سباق إنشاء متزامن → أعد القراءة
      const { data: retry } = await admin.from("referrals").select("code")
        .eq("referrer_tenant_id", tid).is("referee_tenant_id", null).order("created_at", { ascending: true }).limit(1).single();
      if (!retry) return dbFail("referral-code", error);
      mine = retry as any;
    } else {
      mine = ins as any;
    }
  }
  const code = (mine as any).code as string;

  const { data: rows } = await admin.from("referrals").select("status,reward_days,created_at,qualified_at,rewarded_at,referee_tenant_id")
    .eq("referrer_tenant_id", tid).not("referee_tenant_id", "is", null).order("created_at", { ascending: false }).limit(100);
  const byStatus: Record<string, number> = {};
  let earnedDays = 0;
  (rows ?? []).forEach((r: any) => {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    if (r.status === "rewarded") earnedDays += Number(r.reward_days ?? 0);
  });
  const refTids = Array.from(new Set((rows ?? []).map((r: any) => r.referee_tenant_id).filter(Boolean)));
  let refNames: Record<string, string> = {};
  if (refTids.length) {
    const { data: ts } = await admin.from("tenants").select("id,name").in("id", refTids as string[]);
    (ts ?? []).forEach((x: any) => { refNames[x.id] = x.name; });
  }
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "") || null;

  return NextResponse.json({
    ok: true,
    code,
    link: base ? `${base}/?ref=${encodeURIComponent(code)}` : null,
    stats: { pending: byStatus.pending ?? 0, qualified: byStatus.qualified ?? 0, rewarded: byStatus.rewarded ?? 0, earnedDays },
    referrals: (rows ?? []).map((r: any) => ({
      status: r.status, reward_days: r.reward_days,
      created_at: r.created_at, qualified_at: r.qualified_at, rewarded_at: r.rewarded_at,
      referee: r.referee_tenant_id ? (refNames[r.referee_tenant_id] ?? "—") : null,
    })),
  });
}
