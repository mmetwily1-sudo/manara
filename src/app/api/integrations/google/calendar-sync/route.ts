import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";
import { R } from "@/lib/permissions";
import { getProviderToken, googleApi } from "@/lib/google";
import { arError } from "@/lib/auth-errors";

type CalItem = { title: string; start: string; end: string; description?: string; location?: string };

/**
 * POST /api/integrations/google/calendar-sync { items: CalItem[] (≤20) }
 * ينشئ أحداثاً على تقويم المعلم الأساسي — بالتوكن الحي لجلسة الربط.
 */
export async function POST(req: Request) {
  const res = await requireTeacher(R.attendance);
  if ("error" in res) return res.error;
  const { isRateLimited } = await import("@/lib/rate-limit");
  if (isRateLimited(req, "gcal-sync", 10)) {
    return NextResponse.json({ ok: false, error: "too_many_attempts", message: arError("too_many_attempts") }, { status: 429 });
  }
  const token = await getProviderToken();
  if (!token) {
    return NextResponse.json({ ok: false, error: "google_reconnect", message: "اربط حساب جوجل أولاً من الإعدادات ← تكاملات جوجل" }, { status: 401 });
  }
  const b = await req.json().catch(() => ({} as any));
  const items = (Array.isArray(b?.items) ? b.items : []).slice(0, 20) as CalItem[];
  if (!items.length) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });

  let created = 0;
  for (const it of items) {
    const title = String(it.title ?? "").slice(0, 120);
    if (!title || !it.start || !it.end) continue;
    const r = await googleApi(token, "/calendar/v3/calendars/primary/events", {
      method: "POST",
      body: {
        summary: title,
        description: String(it.description ?? "").slice(0, 500),
        location: String(it.location ?? "").slice(0, 120),
        start: { dateTime: it.start },
        end: { dateTime: it.end },
        reminders: { useDefault: true },
      },
    });
    if (r.unauth) {
      return NextResponse.json({ ok: false, created, error: "google_reconnect", message: "انتهت صلاحية الربط — أعد الربط من الإعدادات" }, { status: 401 });
    }
    if (r.ok) created++;
  }
  return NextResponse.json({ ok: true, created, total: items.length });
}
