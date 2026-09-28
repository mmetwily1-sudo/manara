import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/server-auth";

export const FEATURES: { key: string; label: string }[] = [
  { key: "transport", label: "المواصلات 🚌" },
  { key: "events", label: "الفعاليات 🎪" },
  { key: "bundles", label: "الباقات 📦" },
  { key: "library", label: "المكتبة 📚" },
  { key: "shipments", label: "الشحن 🚚" },
];

/** GET /api/features — حالة المزايا (مالك) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const { data } = await res.ctx.admin.from("tenant_features").select("key,enabled")
    .eq("tenant_id", res.ctx.tenantId);
  const map: Record<string, boolean> = {};
  ((data ?? []) as any[]).forEach((f) => { map[f.key] = !!f.enabled; });
  return NextResponse.json({
    ok: true,
    features: FEATURES.map((f) => ({ ...f, enabled: map[f.key] ?? true })),
  });
}

/** PUT /api/features {key, enabled} — تبديل ميزة (مالك) */
export async function PUT(req: Request) {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const b = await req.json().catch(() => ({} as any));
  if (!FEATURES.some((f) => f.key === b?.key)) {
    return NextResponse.json({ ok: false, error: "bad_key" }, { status: 400 });
  }
  const { error } = await res.ctx.admin.from("tenant_features").upsert(
    { tenant_id: res.ctx.tenantId, key: b.key, enabled: !!b.enabled, updated_at: new Date().toISOString() },
    { onConflict: "tenant_id,key" }
  );
  if (error) return NextResponse.json({ ok: false, error: "db", message: (error as any)?.message ?? "" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
