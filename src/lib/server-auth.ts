import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return null;
  return { url, anon, service };
}

export function adminClient() {
  const e = env();
  if (!e) throw new Error("missing_supabase_env");
  return createClient(e.url, e.service, { auth: { persistSession: false } });
}

export async function getSessionUser() {
  const e = env();
  if (!e) return null;
  const store = cookies();
  const sb = createServerClient(e.url, e.anon, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(cs: any[]) {
        cs.forEach(({ name, value, options }: any) => {
          try { store.set(name, value, options); } catch {}
        });
      },
    },
  });
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

/**
 * بوابة إدارة المنصة: أي مستخدم دوره platform_admin (بلا شرط سنتر).
 * تُستخدم لمسارات /api/admin — لأن مدير المنصة قد لا ينتمي لسنتر.
 */
export async function requirePlatformAdmin(): Promise<
  | { ctx: { admin: any; user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>; adminId: string } }
  | { error: ReturnType<typeof NextResponse.json> }
> {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "unauth" }, { status: 401 }) };
  let admin;
  try {
    admin = adminClient();
  } catch {
    return { error: NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 }) };
  }
  const { data: urow } = await admin
    .from("users")
    .select("id,role")
    .eq("auth_user_id", user.id)
    .single();
  if (!urow || (urow as any).role !== "platform_admin") {
    return { error: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  }
  return { ctx: { admin, user, adminId: (urow as any).id } };
}

/** هل الخطأ = جدول غير موجود (ترحيل لم يُنفذ بعد)؟ يغطي 42P01 وPGRST204 */
export function isMissingTable(err: any): boolean {
  if (!err) return false;
  const code = String(err.code ?? "");
  if (code === "42P01" || code === "PGRST204") return true;
  const msg = String(err.message ?? "");
  return /Could not find the table/i.test(msg) || /relation .* does not exist/i.test(msg);
}

export type TeacherContext = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any;
  user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
  tenantId: string;
  userRow: { id: string; tenant_id: string; role: string };
};

/**
 * يتحقق من الجلسة + صف المستخدم، ويرجع سياق المعلم أو رد خطأ جاهز.
 * @param roles إن مُررت (مثل ["teacher_admin"]) يُرفض أي role خارجها بـ 403 —
 * يمنع طالباً داخل السنتر من استدعاء APIs المعلم.
 */
export async function requireTeacher(roles?: string[]): Promise<{ ctx: TeacherContext } | { error: ReturnType<typeof NextResponse.json> }> {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "unauth" }, { status: 401 }) };
  let admin;
  try {
    admin = adminClient();
  } catch {
    return { error: NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 }) };
  }
  const { data: urow } = await admin
    .from("users")
    .select("id,tenant_id,role")
    .eq("auth_user_id", user.id)
    .single();
  if (!urow?.tenant_id) {
    return { error: NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 }) };
  }
  if (roles?.length && !roles.includes(urow.role)) {
    return { error: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  }
  // السنتر الموقوف: كل عمليات الطاقم مرفوضة فوراً (قرار المالك)
  const { data: trow } = await admin.from("tenants").select("status").eq("id", urow.tenant_id).single();
  if ((trow as any)?.status && (trow as any).status !== "active") {
    return { error: NextResponse.json({ ok: false, error: "tenant_suspended", message: "حساب السنتر موقوف — تواصل مع إدارة المنصة" }, { status: 403 }) };
  }
  return { ctx: { admin, user, tenantId: urow.tenant_id, userRow: urow } };
}

/**
 * بوابة مدير السلسلة: المستخدم عضو chain_admin في chain_members لسلسلة بعينها.
 * يُستخدم لـ/api/chains/* — تقارير مجمّعة عبر فروع متعددة (chain واحدة).
 * لا علاقة له بـrequireTeacher (سنتر واحد) ولا requirePlatformAdmin (كل شيء).
 */
export async function requireChainAdmin(chainId: string): Promise<
  | { ctx: { admin: any; userId: string; chainId: string; tenantIds: string[] } }
  | { error: ReturnType<typeof NextResponse.json> }
> {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "unauth" }, { status: 401 }) };
  let admin;
  try {
    admin = adminClient();
  } catch {
    return { error: NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 }) };
  }
  const { data: urow } = await admin.from("users").select("id,role").eq("auth_user_id", user.id).single();
  if (!urow) return { error: NextResponse.json({ ok: false, error: "unauth" }, { status: 401 }) };

  const isPlatform = (urow as any).role === "platform_admin";
  if (!isPlatform) {
    const { data: member } = await admin.from("chain_members").select("role")
      .eq("chain_id", chainId).eq("user_id", (urow as any).id).maybeSingle();
    if (!member) return { error: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  }
  const { data: tenants } = await admin.from("tenants").select("id").eq("chain_id", chainId);
  const tenantIds = ((tenants ?? []) as any[]).map((t) => t.id);
  return { ctx: { admin, userId: (urow as any).id, chainId, tenantIds } };
}
