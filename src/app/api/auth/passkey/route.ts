import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server-auth";
import { getPasskeys, savePasskeys } from "@/lib/webauthn";

/** قائمة بصمات المستخدم الحالي */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const list = await getPasskeys(user.id);
  return NextResponse.json({
    ok: true,
    passkeys: list.map((c) => ({ id: c.id, name: c.name, createdAt: c.createdAt })),
  });
}

/** حذف بصمة */
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const body = await req.json().catch(() => null as any);
  const id = (body?.id ?? "").toString();
  if (!id) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  const list = await getPasskeys(user.id);
  await savePasskeys(user.id, list.filter((c) => c.id !== id));
  return NextResponse.json({ ok: true });
}
