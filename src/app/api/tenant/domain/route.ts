import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher, adminClient } from "@/lib/server-auth";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "manara.app";

/** شكل دومين صالح أساسي (بلا بروتوكول/مسار/فراغات) — تحقق سطحي، التأكد الحقيقي بربط DNS فعلياً */
function isValidDomainShape(d: string): boolean {
  return /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/i.test(d) && d.length <= 255;
}

/** GET /api/tenant/domain — الدومين المخصص الحالي + تعليمات الربط (مالك) */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const { data, error } = await adminClient().from("tenants")
    .select("slug,custom_domain").eq("id", res.ctx.tenantId).single();
  if (error) return dbFail("domain-get", error);
  return NextResponse.json({
    ok: true,
    custom_domain: (data as any)?.custom_domain ?? null,
    subdomain: `${(data as any)?.slug}.${ROOT_DOMAIN}`,
    // المعلم يوجّه CNAME لدومين المنصة — القيمة الفعلية تُضبط حسب استضافتك (Vercel/Cloudflare)
    cname_target: ROOT_DOMAIN,
  });
}

/** PUT /api/tenant/domain { domain } — ضبط/إزالة الدومين المخصص (مالك فقط) */
export async function PUT(req: Request) {
  const res = await requireTeacher(["teacher_admin"], { req: req });
  if ("error" in res) return res.error;
  const admin = adminClient();
  const body = await req.json().catch(() => null as any);
  const raw = String(body?.domain ?? "").trim().toLowerCase();

  // حذف الدومين المخصص (رجوع للـsubdomain فقط)
  if (!raw) {
    const { error } = await admin.from("tenants").update({ custom_domain: null }).eq("id", res.ctx.tenantId);
    if (error) return dbFail("domain-clear", error);
    return NextResponse.json({ ok: true, custom_domain: null });
  }

  if (!isValidDomainShape(raw)) {
    return NextResponse.json({ ok: false, error: "invalid_domain", message: "صيغة الدومين غير صحيحة — مثال: ahmedcenter.com" }, { status: 400 });
  }
  if (raw === ROOT_DOMAIN || raw.endsWith(`.${ROOT_DOMAIN}`)) {
    return NextResponse.json({ ok: false, error: "reserved_domain", message: "هذا الدومين محجوز لمنارة نفسها — استخدم الـsubdomain الخاص بك بدلاً منه" }, { status: 400 });
  }

  const { data: taken } = await admin.from("tenants").select("id").eq("custom_domain", raw).neq("id", res.ctx.tenantId).maybeSingle();
  if (taken) {
    return NextResponse.json({ ok: false, error: "domain_taken", message: "هذا الدومين مربوط بسنتر آخر بالفعل" }, { status: 409 });
  }

  const { error } = await admin.from("tenants").update({ custom_domain: raw }).eq("id", res.ctx.tenantId);
  if (error) {
    // unique constraint على custom_domain في schema.sql — خط دفاع ثانٍ لو فات شرط التحقق أعلاه بسباق تزامن
    if ((error as any).code === "23505") {
      return NextResponse.json({ ok: false, error: "domain_taken", message: "هذا الدومين مربوط بسنتر آخر بالفعل" }, { status: 409 });
    }
    return dbFail("domain-set", error);
  }
  return NextResponse.json({ ok: true, custom_domain: raw });
}
