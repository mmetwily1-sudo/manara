import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { getSessionUser, adminClient } from "@/lib/server-auth";

type Hit = { scope: string; id: string; title: string; snippet: string };

/** GET /api/search?q= — بحث موحد: مذكراتي + المكتبة + بنك الأسئلة (معلم) + المعرفة */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role")
    .eq("auth_user_id", user.id).single();
  if (!urow) return NextResponse.json({ ok: false, error: "no_tenant" }, { status: 403 });
  const tid = (urow as any).tenant_id;
  const sid = (urow as any).id;
  const isTeacher = (urow as any).role !== "student";
  const q = String(new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ ok: true, hits: [] });
  const like = `%${q}%`;
  const hits: Hit[] = [];
  try {
    let nq = admin.from("notes").select("id,title,subject,content").eq("tenant_id", tid)
      .or(`title.ilike.${like},content.ilike.${like},subject.ilike.${like}`);
    // الطالب: العامة + مذكراته فقط (احترام الرؤية)
    if (!isTeacher) nq = nq.or(`visibility.eq.public,created_by.eq.${sid}`);
    const [notes, libs, ques, kb] = await Promise.all([
      nq.limit(10),
      admin.from("library_items").select("id,title,subject").eq("tenant_id", tid).eq("active", true)
        .or(`title.ilike.${like},subject.ilike.${like}`).limit(10),
      isTeacher
        ? admin.from("questions").select("id,subject,body").eq("tenant_id", tid).ilike("body", like).limit(10)
        : Promise.resolve({ data: [] as any[] }),
      admin.from("edu_knowledge").select("id,title,body").or(`title.ilike.${like},body.ilike.${like}`).limit(10),
    ]);
    ((notes.data ?? []) as any[]).forEach((n) =>
      hits.push({ scope: "notes", id: n.id, title: n.title, snippet: `${n.subject} — ${String(n.content ?? "").slice(0, 120)}` }));
    ((libs.data ?? []) as any[]).forEach((l) =>
      hits.push({ scope: "library", id: l.id, title: l.title, snippet: l.subject }));
    ((ques.data ?? []) as any[]).forEach((x) =>
      hits.push({ scope: "questions", id: x.id, title: x.subject, snippet: String(x.body ?? "").slice(0, 120) }));
    ((kb.data ?? []) as any[]).forEach((k) =>
      hits.push({ scope: "knowledge", id: k.id, title: k.title, snippet: String(k.body ?? "").slice(0, 120) }));
  } catch (e) {
    return dbFail("unified-search", e);
  }
  // طالب: مذكراته الخاصة فقط تُفلتر هنا (الرؤية التفصيلية تُحكم في صفحاتها)
  return NextResponse.json({ ok: true, isTeacher, hits: hits.slice(0, 30) });
}
