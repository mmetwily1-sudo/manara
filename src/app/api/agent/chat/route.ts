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
    const { visionChain } = await import("@/lib/vision");
    const keys = visionChain(
      (trow as any)?.settings?.vision_key ?? null,
      (trow as any)?.settings?.vision_key_2 ?? null
    );
    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (o: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
        send({ type: "thread", thread_id: threadId });
        const steps: { tool: string; ok: boolean }[] = [];
        let text = "";
        let usedMastra = false;
        let via: "mastra" | "raw" = "raw";
        // الاستقلال أولاً: نموذج مستضاف ذاتياً يغني عن Mastra وGemini معاً
        const selfHosted = !!process.env.AGENT_LLM_URL;
        // المسار الأول: Mastra (بث حي + ذاكرة) — يُتخطى عند وجود مستضاف ذاتي (الحلقة الخام تستخدمه مباشرة)
        // (التناوب فقط ما لم يُرسل شيء بعد — تفادياً لتكرار المحتوى)
        for (let ki = 0; ki < keys.length && !usedMastra && text.length === 0 && steps.length === 0 && !selfHosted; ki++) {
          try {
            const { getManaraAgent } = await import("@/mastra/agent");
            const agent = getManaraAgent(keys[ki], admin, tid, keys);
            const full: any = await agent.stream(message, {
              resourceId: `${tid}:${uid}`,
              threadId,
              maxSteps: 5,
            } as any);
            const seenTypes: string[] = [];
            const feed = full?.fullStream ?? full?.textStream ?? [];
            for await (const chunk of feed) {
              const c = chunk as any;
              const t = String(c?.type ?? "unknown");
              if (seenTypes.indexOf(t) < 0) seenTypes.push(t);
              const txt: string =
                (typeof c.textDelta === "string" && c.textDelta) ||
                (typeof c.delta === "string" && c.delta) ||
                (typeof c.text === "string" && t !== "tool-call" ? c.text : "") ||
                "";
              if (txt) {
                text += txt;
                send({ type: "token", text: txt });
              }
              if (t === "error") {
                let em = "";
                try {
                  const p = c.payload;
                  em = String(
                    (p && (p.message || p.error)) ??
                    c.error?.message ?? c.message ?? c.error ?? JSON.stringify(p ?? "").slice(0, 200) ?? "unknown"
                  ).slice(0, 250);
                } catch { em = "unreadable"; }
                (controller as any).__shapes = (((controller as any).__shapes ?? "") + "|err:" + em).slice(0, 400);
              }
              const toolName = String(c.toolName ?? c.name ?? c.tool ?? "");
              if (/tool[-_]?call/i.test(t) && toolName) {
                steps.push({ tool: toolName, ok: true });
                send({ type: "step", tool: toolName, ok: true });
              } else if (/tool[-_ ]?(result|error|output)/i.test(t)) {
                const failed = /error/i.test(t) || c.isError === true;
                for (let si = steps.length - 1; si >= 0; si--) {
                  if (steps[si].tool === toolName) { if (failed) steps[si].ok = false; break; }
                }
              }
            }
            if (!text && typeof full?.text !== "undefined") {
              try {
                const fin = await full.text;
                if (typeof fin === "string" && fin.trim()) text = fin;
              } catch {}
            }
            (controller as any).__shapes = (((controller as any).__shapes ?? "") + "|seen:" + seenTypes.join(",")).slice(0, 500);
            const { hasCJK } = await import("@/lib/agent");
            if (hasCJK(text)) text = ""; // رد ملوث بلغات أخرى → يُسقط للمسار الصادق
            // نص فقط هو المعيار (خطوات بلا نص تُعاد عبر الحلقة الخام التي تعرض حتمياً)
            usedMastra = text.length > 0;
            if (usedMastra) via = "mastra";
          } catch (e: any) {
            try {
              const msg = String(e?.message ?? e).slice(0, 300);
              console.error("[agent:mastra]", msg);
              (controller as any).__mastraErr = (((controller as any).__mastraErr ?? "") + "|throw:" + msg).slice(0, 300);
            } catch {}
          }
        }
        // المسار الاحتياطي: الحلقة الخام المختبرة
        if (!usedMastra) {
          const out = await runAgent(
            admin, tid, history,
            (trow as any)?.settings?.vision_key ?? null,
            (trow as any)?.settings?.vision_key_2 ?? null,
            (s) => {
              steps.push(s);
              send({ type: "step", ...s });
            }
          );
          text = out.text;
          steps.length = 0;
          steps.push(...out.steps);
        }
        await admin.from("agent_messages").insert([
          { tenant_id: tid, thread_id: threadId, role: "user", content: message },
          { tenant_id: tid, thread_id: threadId, role: "assistant", content: text },
        ]);
        send({ type: "done", thread_id: threadId, text, steps, suggest: followUps(steps), via, debug: [((controller as any).__mastraErr ?? ""), ((controller as any).__shapes ?? "")].filter(Boolean).join(" | ") || null });
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
