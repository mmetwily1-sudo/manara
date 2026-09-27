import { NextResponse } from "next/server";
import { R } from "@/lib/permissions";
import { getSessionUser, adminClient } from "@/lib/server-auth";
import { dbFail } from "@/lib/api-error";
import { isMissingTable } from "@/lib/server-auth";

const MAX_BYTES = 50 * 1024 * 1024;

/**
 * GET /api/store — الكتالوج (طالب: النشط فقط + حالة طلبي. معلم: الكل).
 * POST /api/store (معلم، multipart: title/description/price/file?) — منتج رقمي جديد.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  const tid = (urow as any).tenant_id;
  const isTeacher = (urow as any).role === "teacher_admin";
  try {
    let q = admin.from("products").select("id,title,description,price,is_active,stock_qty,low_stock_at,subject,lesson,created_at")
      .eq("tenant_id", tid).order("created_at", { ascending: false }).limit(100);
    if (!isTeacher) q = q.eq("is_active", true);
    const { data: prods, error } = await q;
    if (error) throw error;
    let myOrders: Record<string, { status: string; order_id: string }> = {};
    if (!isTeacher) {
      const { data: ords } = await admin.from("orders").select("id,product_id,status")
        .eq("tenant_id", tid).eq("student_id", (urow as any).id);
      for (const o of (ords ?? []) as any[]) myOrders[o.product_id] = { status: o.status, order_id: o.id };
    }
    return NextResponse.json({
      ok: true,
      products: ((prods ?? []) as any[]).map((p) => ({
        ...p,
        my_status: myOrders[p.id]?.status ?? null,
        my_order_id: myOrders[p.id]?.order_id ?? null,
      })),
    });
  } catch (e: any) {
    if (isMissingTable(e)) return NextResponse.json({ ok: false, error: "not_ready" }, { status: 400 });
    return dbFail("store-list", e);
  }
}

export async function POST(req: Request) {
  const { requireTeacher } = await import("@/lib/server-auth");
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;

  let form: FormData;
  try { form = await req.formData(); } catch {
    return NextResponse.json({ ok: false, error: "bad_form" }, { status: 400 });
  }
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  const price = Math.max(0, Number(form.get("price") ?? 0) || 0);
  if (title.length < 2) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  const file = form.get("file");

  let filePath: string | null = null;
  if (file instanceof Blob && (file as File).size > 0) {
    const f = file as File;
    if (f.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "too_large", message: "حجم الملف يتجاوز 50MB." }, { status: 400 });
    }
    try { await admin.storage.createBucket("store", { public: false }); } catch {}
    const safe = String(f.name ?? "file").replace(/[^\w.\-() ]/g, "_").slice(0, 80) || "file";
    filePath = `${tid}/${Date.now()}-${safe}`;
    const { error } = await admin.storage.from("store").upload(filePath, Buffer.from(await f.arrayBuffer()), {
      contentType: f.type || "application/octet-stream", upsert: true,
    });
    if (error) return dbFail("store-upload", error, "upload_failed");
  }
  try {
    const { data, error } = await admin.from("products").insert({
      tenant_id: tid, title,
      description: String(form.get("description") ?? "").trim().slice(0, 2000) || null,
      price, file_path: filePath, is_active: true,
      subject: String(form.get("subject") ?? "").trim().slice(0, 80),
      lesson: String(form.get("lesson") ?? "").trim().slice(0, 120),
    }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: (data as any).id });
  } catch (e: any) {
    if (isMissingTable(e)) {
      return NextResponse.json({ ok: false, error: "not_ready", message: "نفّذ ترحيل 006 من لوحة Supabase أولاً." }, { status: 400 });
    }
    return dbFail("store-create", e);
  }
}
