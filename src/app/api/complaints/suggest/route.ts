import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { getSessionUser, adminClient } from "@/lib/server-auth";

const RULES: { keys: string[]; reply: (name: string, ticket: string) => string }[] = [
  {
    keys: ["مصاريف", "فلوس", "فاتورة", "دفع", "قسط", "مبلغ"],
    reply: (n, t) => `أهلاً ${n}، استلمنا ملاحظتك عن المصاريف (تذكرة ${t}) — راجعنا حسابك وسيتواصل المحاسب خلال 48 ساعة.`,
  },
  {
    keys: ["غياب", "حضور", "تأخير", "حصة"],
    reply: (n, t) => `أهلاً ${n}، سجلنا ملاحظتك عن الحضور (تذكرة ${t}) — راجعنا سجل حضورك وسنعالج أي خطأ.`,
  },
  {
    keys: ["امتحان", "درجة", "تصحيح", "نتيجة"],
    reply: (n, t) => `أهلاً ${n}، وصلتنا ملاحظتك عن الامتحانات (تذكرة ${t}) — سيعيد المعلم مراجعة ورقتك ويبلغك بالنتيجة.`,
  },
  {
    keys: ["مدرس", "شرح", "معلم", "أستاذ"],
    reply: (n, t) => `أهلاً ${n}، شكراً لصراحتك (تذكرة ${t}) — سيتابع المشرف الأمر مع المعلم ونبلغك بما تم.`,
  },
];

/** GET /api/complaints/suggest?id= — اقتراح رد قاعدي حسب النوع والكلمات (معلم) */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role").eq("auth_user_id", user.id).single();
  if (!urow || (urow as any).role === "student") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  const { data: c, error } = await admin.from("complaints").select("id,kind,body,student_id")
    .eq("id", id).eq("tenant_id", (urow as any).tenant_id).single();
  if (error || !c) return dbFail("complaint-get", error);
  let student = "صديقنا";
  if ((c as any).student_id) {
    const { data: st } = await admin.from("users").select("full_name").eq("id", (c as any).student_id).single();
    const full = String((st as any)?.full_name ?? "").trim();
    if (full) student = full.split(/\s+/)[0];
  }
  const ticket = `#${String((c as any).id).slice(0, 6)}`;
  const body = String((c as any).body ?? "");
  if ((c as any).kind === "suggestion") {
    return NextResponse.json({ ok: true, suggestion: `شكراً ${student} على اقتراحك ${ticket} 💡 — درسناه وسنبلغك بقرار الإدارة.` });
  }
  for (const r of RULES) {
    if (r.keys.some((k) => body.includes(k))) {
      return NextResponse.json({ ok: true, suggestion: r.reply(student, ticket) });
    }
  }
  return NextResponse.json({ ok: true, suggestion: `أهلاً ${student}، استلمنا رسالتك ${ticket} وسنرد عليك خلال 48 ساعة. شكراً لتواصلك.` });
}
