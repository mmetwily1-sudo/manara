import { NextResponse } from "next/server";
import { dbFail } from "@/lib/api-error";
import { isMissingTable } from "@/lib/server-auth";
import { runAgent, followUps, type AgentHistory } from "@/lib/agent";

/**
 * POST /api/agent/chat { thread_id?, message } — دور محادثة مع الوكيل.
 * يحمّل آخر 10 رسائل كذاكرة، يشغّل الحلقة (سقف 5 خطوات)، ويحفظ الدور.
 */
export async function POST(req: Request) {
  const { requireTeacher, adminClient } = await import("@/lib/server-auth");
  const res = await requireTeacher(["teacher_admin"]);
  if ("error" in res) return res.error;
  const admin = adminClient();
  const tid = res.ctx.tenantId;
  const uid = res.ctx.userRow.id;

  const { isRateLimited } = await import("@/lib/rate-limit");
  if (isRateLimited(req, "agent-chat", 20, 60 * 60 * 1000, tid)) {
    return NextResponse.json({ ok: false, error: "rate_limited", message: "تجاوزت حد المحادثة (20/ساعة)." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({} as any));
  const message = String(body.message ?? "").trim().slice(0, 2000);
  if (message.length < 2) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  try {
    // المحادثة: موجودة أو جديدة
    let threadId = String(body.thread_id ?? "");
    if (threadId) {
      const { data: th } = await admin.from("agent_threads").select("id")
        .eq("id", threadId).eq("tenant_id", tid).eq("user_id", uid).single();
      if (!th) return NextResponse.json({ ok: false, error: "bad_thread" }, { status: 400 });
    } else {
      const { data: th, error } = await admin.from("agent_threads").insert({
        tenant_id: tid, user_id: uid, title: message.slice(0, 60),
      }).select("id").single();
      if (error) throw error;
      threadId = (th as any).id;
    }

    const { data: past } = await admin.from("agent_messages").select("role,content")
      .eq("thread_id", threadId).order("created_at", { ascending: true }).limit(10);
    const history: AgentHistory[] = ((past ?? []) as any[])
      .filter((m) => m.role !== "tool" && m.content)
      .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", text: String(m.content).slice(0, 2000) }));
    history.push({ role: "user", text: message });

    const { data: trow } = await admin.from("tenants").select("settings").eq("id", tid).single();
    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (o: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
        send({ type: "thread", thread_id: threadId });
        const out = await runAgent(
          admin, tid, history,
          (trow as any)?.settings?.vision_key ?? null,
          (trow as any)?.settings?.vision_key_2 ?? null,
          (s) => send({ type: "step", ...s })
        );
        await admin.from("agent_messages").insert([
          { tenant_id: tid, thread_id: threadId, role: "user", content: message },
          { tenant_id: tid, thread_id: threadId, role: "assistant", content: out.text },
        ]);
        send({ type: "done", thread_id: threadId, text: out.text, steps: out.steps, suggest: followUps(out.steps) });
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (e: any) {
    if (isMissingTable(e)) {
      return NextResponse.json({ ok: false, error: "not_ready", message: "نفّذ ترحيل 007 أولاً." }, { status: 400 });
    }
    return dbFail("agent-chat", e);
  }
}
