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
  return { ctx: { admin, user, tenantId: urow.tenant_id, userRow: urow } };
}
