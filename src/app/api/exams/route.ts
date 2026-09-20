import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireTeacher } from "@/lib/server-auth";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function supaUser() {
  if (!SUPA_URL || !ANON) return null;
  const store = cookies();
  return createServerClient(SUPA_URL, ANON, { cookies: { getAll() { return store.getAll(); }, setAll(cs: any[]) { cs.forEach(({ name, value, options }: any) => store.set(name, value, options)); } } });
}

function admin() {
  return createClient(SUPA_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

/** GET /api/exams — قائمة امتحانات سنتر المستخدم الحالي */
export async function GET() {
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const sb = res.ctx.admin;
  const urow = { tenant_id: res.ctx.tenantId };

  const { data: exams } = await sb
    .from("exams")
    .select("id,title,duration_minutes,total_marks,is_published,created_at")
    .eq("tenant_id", urow.tenant_id)
    .order("created_at", { ascending: false })
    .limit(50);

  const ids = (exams ?? []).map((e: any) => e.id);
  const idSet = new Set(ids);
  let qCounts: Record<string, number> = {};
  let aCounts: Record<string, number> = {};
  let draftCounts: Record<string, number> = {};
  if (ids.length) {
    const [{ data: links }, { data: attempts }, { data: drafts }] = await Promise.all([
      sb.from("exam_questions").select("exam_id").in("exam_id", ids),
      sb.from("exam_attempts").select("exam_id").in("exam_id", ids),
      sb.from("questions").select("source_detail").eq("tenant_id", urow.tenant_id).eq("status", "draft"),
    ]);
    for (const l of (links ?? []) as any[]) qCounts[l.exam_id] = (qCounts[l.exam_id] ?? 0) + 1;
    for (const a of (attempts ?? []) as any[]) aCounts[a.exam_id] = (aCounts[a.exam_id] ?? 0) + 1;
    // مسودات كل امتحان (مخزنة في source_detail JSON)
    for (const d of (drafts ?? []) as any[]) {
      try {
        const eid = JSON.parse(d.source_detail ?? "{}")?.exam_id;
        if (eid && idSet.has(eid)) draftCounts[eid] = (draftCounts[eid] ?? 0) + 1;
      } catch {}
    }
  }

  return NextResponse.json({
    ok: true,
    exams: (exams ?? []).map((e: any) => ({
      ...e,
      questions_count: qCounts[e.id] ?? 0,
      attempts_count: aCounts[e.id] ?? 0,
      pending_drafts: draftCounts[e.id] ?? 0,
    })),
  });
}
