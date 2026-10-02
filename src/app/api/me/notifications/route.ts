import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";
import { eventLabel } from "@/lib/notify-labels";

/** GET /api/me/notifications — صندوق الطالب نفسه (جلسة الدخول برقم الهاتف) */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  let admin;
  try {
    admin = adminClient();
  } catch {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
  }
  const { data: urow } = await admin.from("users").select("id,tenant_id")
    .eq("auth_user_id", user.id).limit(1).single();
  if (!(urow as any)?.id) return NextResponse.json({ ok: false, error: "no_profile" }, { status: 403 });
  const { data: logs } = await admin.from("notification_log")
    .select("event,channel,status,sent_at,created_at,payload")
    .eq("tenant_id", (urow as any).tenant_id).eq("user_id", (urow as any).id)
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
