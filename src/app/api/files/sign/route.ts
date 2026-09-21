import { NextResponse } from "next/server";
import { getSessionUser, adminClient } from "@/lib/server-auth";

/**
 * GET /api/files/sign?path=homework/{tid}/{aid}/{sid}/f.png
 * روابط تحميل موقعة قصيرة (5 دقائق) — الباكتات خاصة ولا تُكشف علناً.
 * exam-pages و omr: معلم فقط. homework: معلم، أو الطالب لملفاته فقط.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const admin = adminClient();
  const { data: urow } = await admin
    .from("users").select("id,tenant_id,role").eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  const tid = (urow as any).tenant_id;
  const sid = (urow as any).id;
  const isTeacher = (urow as any).role === "teacher_admin";

  const p = new URL(req.url).searchParams.get("path") ?? "";
  const m = p.match(/^(homework|omr|exam-pages)\/(.+)$/);
  if (!m) return NextResponse.json({ ok: false, error: "bad_path" }, { status: 400 });
  const [, bucket, rest] = m;
  const seg = rest.split("/");

  if (bucket === "homework") {
    if (seg[0] !== tid) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    if (!isTeacher && seg[2] !== sid) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  } else {
    // exam-pages و omr صور مراجعة داخلية — معلم السنتر فقط
    if (!isTeacher || seg[0] !== tid) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await admin.storage.from(bucket).createSignedUrl(rest, 300);
  if (error || !data?.signedUrl) return NextResponse.json({ ok: false, error: "sign_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, url: data.signedUrl });
}
