import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { rpInfo, findAuthUserByEmail, getUserMeta, savePasskeys, setUserMeta } from "@/lib/webauthn";
import { adminClient } from "@/lib/server-auth";

/** تأكيد الدخول بالبصمة — يرجع توكن سحري لإتمام الجلسة في المتصفح */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null as any);
  const email = (body?.email ?? "").trim().toLowerCase();
  const authResp = body?.authResp;
  if (!email || !authResp?.id) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const authUser = await findAuthUserByEmail(email);
  if (!authUser) return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 400 });

  const meta = await getUserMeta(authUser.id);
  const challenge = meta.webauthn_auth_challenge as string | undefined;
  const list = (Array.isArray(meta.webauthn) ? meta.webauthn : []) as any[];
  const cred = list.find((c) => c.id === authResp.id);
  if (!challenge || !cred) {
    return NextResponse.json({ ok: false, error: "expired_challenge" }, { status: 400 });
  }

  const { rpID, origin } = rpInfo();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: authResp,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.id,
        publicKey: isoBase64URL.toBuffer(cred.publicKey),
        counter: cred.counter ?? 0,
        transports: cred.transports,
      } as any,
      requireUserVerification: false,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 400 });
  }
  if (!verification.verified) {
    return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 400 });
  }

  // تحديث العداد + مسح التحدي المستهلك
  cred.counter = verification.authenticationInfo.newCounter;
  await savePasskeys(authUser.id, list);
  await setUserMeta(authUser.id, { webauthn_auth_challenge: null });

  // إصدار رابط سحري — العميل يتحقق منه ويفتح الجلسة
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data?.properties?.action_link) {
    return NextResponse.json({ ok: false, error: "session_failed" }, { status: 500 });
  }
  const token = new URL(data.properties.action_link).searchParams.get("token");
  if (!token) return NextResponse.json({ ok: false, error: "session_failed" }, { status: 500 });

  return NextResponse.json({ ok: true, token, type: "magiclink" });
}
