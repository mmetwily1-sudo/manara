import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { getSessionUser, adminClient } from "@/lib/server-auth";

function curPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function me() {
  const user = await getSessionUser();
  if (!user) return null;
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role")
    .eq("auth_user_id", user.id).single();
  if (!urow) return null;
  return { admin, urow: urow as any };
}

/** GET /api/library — طالب: النشطة + مشترياتي (بالمحتوى للمشتراة) | معلم: الكل + عدد المشترين */
export async function GET() {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const { admin, urow } = m;
  const tid = urow.tenant_id;
  const isTeacher = urow.role !== "student";
  let q = admin.from("library_items").select("id,title,subject,price,active")
    .eq("tenant_id", tid).order("created_at", { ascending: false }).limit(100);
  if (!isTeacher) q = q.eq("active", true);
  const { data: items, error } = await q;
  if (error) return dbFail("library-list", error);
  const out: any = { ok: true, isTeacher, items: items ?? [] };
  const iids = ((items ?? []) as any[]).map((i) => i.id);
  if (isTeacher && iids.length) {
    const { data: purs } = await admin.from("library_purchases").select("item_id")
      .eq("tenant_id", tid).in("item_id", iids).limit(5000);
    const counts: Record<string, number> = {};
    ((purs ?? []) as any[]).forEach((p) => { counts[p.item_id] = (counts[p.item_id] ?? 0) + 1; });
    out.counts = counts;
  }
  if (!isTeacher) {
    const { data: mine } = await admin.from("library_purchases").select("item_id")
      .eq("tenant_id", tid).eq("student_id", urow.id).limit(200);
    const owned = new Set(((mine ?? []) as any[]).map((p) => p.item_id));
    out.owned = Array.from(owned);
    if (owned.size) {
      const { data: full } = await admin.from("library_items").select("id,content")
        .in("id", Array.from(owned) as string[]).limit(200);
      const cmap: Record<string, string> = {};
      ((full ?? []) as any[]).forEach((f) => { cmap[f.id] = f.content ?? ""; });
      out.contents = cmap;
    } else out.contents = {};
  }
  return NextResponse.json(out);
}

/** POST /api/library — معلم: عنصر جديد | طالب: شراء {item_id} (+ فاتورة إن بسعر) */
export async function POST(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const { admin, urow } = m;
  const tid = urow.tenant_id;
  const isTeacher = urow.role !== "student";
  const b = await req.json().catch(() => ({} as any));
  if (isTeacher) {
    if (!String(b?.title ?? "").trim()) return NextResponse.json({ ok: false, error: "bad_input" }, { status: 400 });
    const { error } = await admin.from("library_items").insert({
      tenant_id: tid, title: String(b.title).slice(0, 150), subject: String(b?.subject ?? "").slice(0, 80),
      price: Math.max(0, Number(b?.price ?? 0)), content: String(b?.content ?? "").slice(0, 20000),
    });
    if (error) return dbFail("library-create", error);
    return NextResponse.json({ ok: true });
  }
  const { data: it } = await admin.from("library_items").select("id,price,active")
    .eq("id", b?.item_id).eq("tenant_id", tid).single();
  if (!it || !(it as any).active) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const { featureOn } = await import("@/lib/features");
  if (!(await featureOn(admin, tid, "library"))) {
    return NextResponse.json({ ok: false, error: "feature_disabled" }, { status: 403 });
  }
  const { data: dup } = await admin.from("library_purchases").select("id")
    .eq("tenant_id", tid).eq("item_id", (it as any).id).eq("student_id", urow.id).single();
  if (dup) return NextResponse.json({ ok: false, error: "already" }, { status: 400 });
  let invoiceId: string | null = null;
  const price = Number((it as any).price ?? 0);
  if (price > 0) {
    const { data: inv, error: ie } = await admin.from("invoices").insert({
      tenant_id: tid, student_id: urow.id, period: curPeriod(), amount: price,
    }).select("id").single();
    if (ie || !inv) return dbFail("library-invoice", ie);
    invoiceId = (inv as any).id;
  }
  const { error: pe } = await admin.from("library_purchases").insert({
    tenant_id: tid, item_id: (it as any).id, student_id: urow.id, invoice_id: invoiceId,
  });
  if (pe) return dbFail("library-buy", pe);
  return NextResponse.json({ ok: true, invoiced: price > 0 });
}

/** PATCH /api/library {id, active} — تفعيل/إيقاف (معلم) */
export async function PATCH(req: Request) {
  const m = await me();
  if (!m) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  if (m.urow.role === "student") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({} as any));
  if (!b?.id) return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  const { error } = await m.admin.from("library_items").update({ active: !!b.active })
    .eq("id", b.id).eq("tenant_id", m.urow.tenant_id);
  if (error) return dbFail("library-toggle", error);
  return NextResponse.json({ ok: true });
}
