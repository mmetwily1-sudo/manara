import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { eventLabel } from "@/lib/notify-labels";

/** GET /api/parent/notifications — آخر 30 تنبيهاً للطالب (بكوكيز البوابة، بلا حساب) */
export async function GET(req: Request) {
  const cookieStore = cookies();
  const token = req.headers.get("x-parent-token") ?? cookieStore.get("manara_parent_token")?.value;
  if (!token) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !svc) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
  const admin = createClient(url, svc, { auth: { persistSession: false } });
  const tokenHash = createHash("sha256").update("parent:" + token).digest("hex");
  const { data: sess } = await admin.from("parent_portal_sessions").select("student_id,tenant_id,expires_at")
    .eq("token_hash", tokenHash).limit(1).single();
  if (!sess || new Date((sess as any).expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "expired" }, { status: 401 });
  }
  const sid = (sess as any).student_id;
  const { data: logs } = await admin.from("notification_log")
    .select("event,channel,status,sent_at,created_at,payload")
    .eq("tenant_id", (sess as any).tenant_id).eq("user_id", sid)
    .order("created_at", { ascending: false }).limit(30);
  const seen = new Set<string>();
  const items = (((logs ?? []) as any[])
    .filter((l) => l.status === "sent" || l.status === "queued")
    .map((l) => {
      const body = String((l.payload as any)?.body ?? "").slice(0, 200);
      const key = `${l.event}:${body.slice(0, 60)}`;
      if (seen.has(key)) return null;
      seen.add(key);
      const lab = eventLabel(l.event);
      return { icon: lab.icon, title: lab.title, body, at: l.sent_at ?? l.created_at, channel: l.channel };
    })
    .filter(Boolean)).slice(0, 20);
  return NextResponse.json({ ok: true, items });
}
