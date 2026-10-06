import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/server-auth";
import { dbFail } from "@/lib/api-error";

/** GET /api/admin/chains — كل السلاسل (مالك المنصة فقط) */
export async function GET() {
  const res = await requirePlatformAdmin();
  if ("error" in res) return res.error;
  const { admin } = res.ctx;
  const { data: chains, error } = await admin
    .from("chains")
    .select("id,name,owner_user_id,created_at,tenants(id,name,status)")
    .order("created_at", { ascending: false });
  if (error) return dbFail("chains", error);
  return NextResponse.json({ ok: true, chains: chains ?? [] });
}

/** POST /api/admin/chains { name, ownerUserId } — إنشاء سلسلة جديدة + تعيين مديرها الأول */
export async function POST(req: Request) {
  const res = await requirePlatformAdmin();
  if ("error" in res) return res.error;
  const { admin } = res.ctx;
  const body = await req.json().catch(() => null as any);
  const name = String(body?.name ?? "").trim();
  const ownerUserId = String(body?.ownerUserId ?? "").trim();
  if (!name || name.length < 2) return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });
  if (!ownerUserId) return NextResponse.json({ ok: false, error: "owner_required" }, { status: 400 });

  const { data: owner } = await admin.from("users").select("id").eq("id", ownerUserId).maybeSingle();
  if (!owner) return NextResponse.json({ ok: false, error: "owner_not_found" }, { status: 404 });

  const { data: chain, error } = await admin.from("chains")
    .insert({ name, owner_user_id: ownerUserId }).select("id,name,created_at").single();
  if (error) return dbFail("chains_create", error);

  await admin.from("chain_members").insert({ chain_id: (chain as any).id, user_id: ownerUserId, role: "chain_admin" });
  return NextResponse.json({ ok: true, chain });
}
