import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { getSessionUser, adminClient } from "@/lib/server-auth";
import { rpInfo, getUserMeta, getPasskeys, setUserMeta } from "@/lib/webauthn";

/** تأكيد تسجيل البصمة وحفظها */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

  const body = await req.json().catch(() => null as any);
  const attResp = body?.attResp;
  const name = (body?.name ?? "بصمتي").toString().slice(0, 40) || "بصمتي";
  if (!attResp) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  const meta = await getUserMeta(user.id);
  const challenge = meta.webauthn_reg_challenge as string | undefined;
  if (!challenge) {
    return NextResponse.json({ ok: false, error: "expired_challenge" }, { status: 400 });
  }

  const { rpID, origin } = rpInfo();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: attResp,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 400 });
  }
  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const list = await getPasskeys(user.id);
  if (!list.some((c) => c.id === credential.id)) {
    list.push({
      id: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: (attResp.response.transports ?? []) as string[],
      name,
      createdAt: new Date().toISOString(),
    });
  }
  // حفظ واحد ذري: القائمة + مسح التحدي المستهلك + بصمة الجهاز
  await setUserMeta(user.id, {
    webauthn: list,
    webauthn_reg_challenge: null,
    webauthn_device: { type: credentialDeviceType, backedUp: credentialBackedUp },
  });

  return NextResponse.json({ ok: true, count: list.length });
}
