import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const HOLD_DAYS = 14; // فترة الحماية من الاسترداد/الإلغاء قبل منح المكافأة
const MONTH_CAP = 5;
const YEAR_CAP = 20;
// عرض الافتتاح: مضاعفة المؤقتة — تُضبط عبر البيئة (افتراضي: 14 يوماً حتى 2026-10-31)
const LAUNCH_DAYS = Number(process.env.REFERRAL_LAUNCH_DAYS ?? 14);
const LAUNCH_UNTIL = process.env.REFERRAL_LAUNCH_UNTIL ?? "2026-10-31";
const REFEREE_DAYS = Number(process.env.REFEREE_REWARD_DAYS ?? 7); // مكافأة المُحال (طرف ثانٍ)

/** مدّد اشتراك سنتر بعدد أيام (paid_until وإلا trial) — يرجع التاريخ الجديد */
async function extendSub(admin: any, tenantId: string, days: number): Promise<string | null> {
  const { data: t } = await admin.from("tenants").select("settings,trial_ends_at").eq("id", tenantId).single();
  if (!t) return null;
  const cur = (t as any)?.settings?.plan_paid_until ?? (t as any)?.trial_ends_at ?? null;
  const base = Math.max(Date.now(), cur ? new Date(cur).getTime() : 0);
  const extended = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
  if ((t as any)?.settings?.plan_paid_until) {
    await admin.from("tenants").update({
      settings: { ...(((t as any)?.settings ?? {}) as object), plan_paid_until: extended },
    }).eq("id", tenantId);
  } else {
    await admin.from("tenants").update({ trial_ends_at: extended }).eq("id", tenantId);
  }
  return extended;
}

/**
 * POST /api/referrals/settle — تسوية الإحالات الناضجة (cron يومي، مؤمّن بـ CRON_SECRET).
 * qualified + أقدم من 14 يوم → فحوصات الاحتيال → تمديد اشتراك المُحيل → rewarded
 */
export async function GET(req: Request) {
  return settle(req);
}

export async function POST(req: Request) {
  return settle(req);
}

async function settle(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const isCron = !!secret && auth === `Bearer ${secret}`;
  if (!isCron) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const cutoff = new Date(Date.now() - HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: due } = await admin.from("referrals").select("*")
    .eq("status", "qualified").lt("qualified_at", cutoff).limit(100);

  const out = { rewarded: 0, revoked: 0, skipped: 0 };
  for (const r of (due ?? []) as any[]) {
    try {
      // المُحال ما زال موجوداً ومدفوعاً؟
      const { data: ref } = await admin.from("tenants")
        .select("id,settings").eq("id", r.referee_tenant_id).single();
      if (!ref) {
        await admin.from("referrals").update({ status: "revoked" }).eq("id", r.id);
        out.revoked++;
        continue;
      }
      const { count: paidCount } = await admin.from("platform_payments").select("id", { count: "exact", head: true })
        .eq("tenant_id", r.referee_tenant_id).eq("status", "paid");
      if (!paidCount) {
        await admin.from("referrals").update({ status: "revoked" }).eq("id", r.id);
        out.revoked++;
        continue;
      }
      // منع ذاتي: نفس هاتف المالك؟
      const { data: both } = await admin.from("tenants").select("id,settings")
        .in("id", [r.referrer_tenant_id, r.referee_tenant_id]);
      const phones = (both ?? []).map((t: any) => t?.settings?.owner_phone).filter(Boolean);
      if (phones.length === 2 && phones[0] === phones[1]) {
        await admin.from("referrals").update({ status: "revoked" }).eq("id", r.id);
        out.revoked++;
        continue;
      }
      // هاتف مُحال مكرر عبر سناتر مختلفة؟
      if (r.referee_phone_hash) {
        const { data: dupes } = await admin.from("referrals").select("id,referee_tenant_id")
          .eq("referee_phone_hash", r.referee_phone_hash).neq("status", "revoked").limit(5);
        const others = (dupes ?? []).filter((d: any) => d.referee_tenant_id !== r.referee_tenant_id);
        if (others.length) {
          await admin.from("referrals").update({ status: "revoked" }).eq("id", r.id);
          out.revoked++;
          continue;
        }
      }
      // السقوف
      const m30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const y365 = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
      const { count: c30 } = await admin.from("referrals").select("id", { count: "exact", head: true })
        .eq("referrer_tenant_id", r.referrer_tenant_id).eq("status", "rewarded").gte("rewarded_at", m30);
      const { count: c365 } = await admin.from("referrals").select("id", { count: "exact", head: true })
        .eq("referrer_tenant_id", r.referrer_tenant_id).eq("status", "rewarded").gte("rewarded_at", y365);
      if ((c30 ?? 0) >= MONTH_CAP || (c365 ?? 0) >= YEAR_CAP) { out.skipped++; continue; }

      // المنح: المُحيل (مع عرض الافتتاح المضاعف) + المُحال (طرف ثانٍ لمرة واحدة)
      const launchOn = new Date().toISOString().slice(0, 10) <= LAUNCH_UNTIL;
      const referrerDays = launchOn ? LAUNCH_DAYS : Number(r.reward_days || 7);
      const ext1 = await extendSub(admin, r.referrer_tenant_id, referrerDays);
      if (!ext1) { out.skipped++; continue; }
      let refereeExt: string | null = null;
      if (r.referee_tenant_id) {
        const { count: prevRef } = await admin.from("referrals").select("id", { count: "exact", head: true })
          .eq("referee_tenant_id", r.referee_tenant_id).eq("status", "rewarded");
        if (!prevRef) refereeExt = await extendSub(admin, r.referee_tenant_id, REFEREE_DAYS);
      }
      await admin.from("referrals").update({
        status: "rewarded", rewarded_at: new Date().toISOString(), reward_days: referrerDays,
      }).eq("id", r.id);
      try {
        await admin.from("audit_log").insert({
          tenant_id: r.referrer_tenant_id, actor_id: null,
          action: "referral:reward", entity_type: "referral", entity_id: r.id,
          details: { days: referrerDays, referee: r.referee_tenant_id, referee_extended: !!refereeExt, launch: launchOn },
        });
      } catch {}
      out.rewarded++;
    } catch { out.skipped++; }
  }
  return NextResponse.json({ ok: true, ...out });
}
