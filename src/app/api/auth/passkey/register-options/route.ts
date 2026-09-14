import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getSessionUser } from "@/lib/server-auth";
import { rpInfo, getPasskeys, setUserMeta } from "@/lib/webauthn";

/** بدء تسجيل بصمة جديدة — يتطلب جلسة دخول سارية */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const { rpID } = rpInfo();
  const existing = await getPasskeys(user.id);

  const options = await generateRegistrationOptions({
    rpName: "منارة",
    rpID,
    userID: Buffer.from(user.id, "utf8"),
    userName: user.email ?? user.id,
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({ id: c.id, transports: (c.transports ?? []) as any })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await setUserMeta(user.id, { webauthn_reg_challenge: options.challenge });
  return NextResponse.json({ ok: true, options });
}
