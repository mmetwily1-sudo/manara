import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { requireTeacher } from "@/lib/server-auth";
import { coreSubject } from "@/mastra/tool-impls";
import { R } from "@/lib/permissions";

const normWords = (s: string): string[] =>
  String(s ?? "")
    .replace(/[؟?.,،;:()«»"'-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^ال(?=.{2})/, "").trim())
    .filter((w) => w.length >= 3);

/**
 * POST /api/questions/auto-link — ربط أسئلتك بالدروس تلقائياً.
 * {action:"suggest"} → [{qid, body, subject, code, lesson, score}]
 * {action:"apply", links:[{qid, code}]} → تحديث lesson_code + audit
 */
export async function POST(req: Request) {
  const res = await requireTeacher(R.content);
  if ("error" in res) return res.error;
  const admin = res.ctx.admin;
  const tid = res.ctx.tenantId;
  const body = await req.json().catch(() => ({} as any));

  try {
    if (body?.action === "apply") {
      const links = Array.isArray(body?.links) ? body.links.slice(0, 200) : [];
      let updated = 0;
      for (const l of links) {
        const qid = String(l?.qid ?? "");
        const code = String(l?.code ?? "").slice(0, 40);
        if (!qid || !code) continue;
        const { data: ls } = await admin.from("curriculum_lessons").select("code").eq("code", code).limit(1).single();
        if (!ls) continue;
        const { error } = await admin.from("questions").update({ lesson_code: code })
          .eq("id", qid).eq("tenant_id", tid).eq("status", "approved");
        if (!error) updated++;
      }
      try {
        await admin.from("audit_log").insert({
          tenant_id: tid, actor_id: res.ctx.userRow.id,
          action: "questions:auto_link", entity_type: "question", entity_id: "bulk", details: { updated },
        });
      } catch {}
      return NextResponse.json({ ok: true, updated });
    }

    // suggest
    const { data: qs } = await admin.from("questions").select("id,body,subject")
      .eq("tenant_id", tid).eq("status", "approved").is("lesson_code", null).limit(200);
    const { data: lessons } = await admin.from("curriculum_lessons").select("code,subject,lesson_title,unit_title").limit(2000);
    const bySubj: Record<string, any[]> = {};
    (lessons ?? []).forEach((l: any) => {
      const s = coreSubject(l.subject ?? "");
      (bySubj[s] ??= []).push({ ...l, _w: normWords(l.lesson_title + " " + (l.unit_title ?? "")) });
    });
    const out: any[] = [];
    for (const q of (qs ?? []) as any[]) {
      const qw = normWords((q.body ?? "") + " " + (q.subject ?? ""));
      const qset = new Set(qw);
      const cands = bySubj[coreSubject(q.subject ?? "")] ?? [];
      let best: any = null;
      for (const l of cands) {
        const shared = l._w.filter((w: string) => qset.has(w));
        const score = new Set(shared).size;
        if (!best || score > best.score) best = { code: l.code, lesson: l.lesson_title, unit: l.unit_title, score, shared: Array.from(new Set(shared)).slice(0, 5) };
      }
      if (best && best.score >= 2) {
        out.push({ qid: q.id, body: String(q.body ?? "").slice(0, 90), subject: q.subject, ...best });
      }
    }
    out.sort((a, b) => b.score - a.score);
    return NextResponse.json({ ok: true, unlinked: (qs ?? []).length, suggestions: out.slice(0, 100) });
  } catch (e: any) {
    return dbFail("auto-link", e);
  }
}
