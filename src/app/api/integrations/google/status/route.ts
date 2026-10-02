import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server-auth";
import { getProviderToken, googleCaps } from "@/lib/google";

/** GET — صلاحيات جوجل الممنوحة حالياً (من التوكن الحي، بلا تخزين) */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const token = await getProviderToken();
  if (!token) {
    return NextResponse.json({
      ok: true,
      caps: { calendar: false, sheets: false, gmail: false },
      hint: "no_token",
    });
  }
  const caps = await googleCaps(token);
  return NextResponse.json({ ok: true, caps });
}
