"use client";

import { useEffect, useState } from "react";

type Session = {
  id: string; title: string; provider: string; ext_url: string; room: string; starts_at: string;
};
type Hand = { student_id: string; name: string; created_at: string };

/** غرفة اللايف: Jitsi مضمنة (المعلم يدخل أولاً مشرفاً) أو زر خارجي + حضور تلقائي + رفع يد */
export function LiveRoomClient({ session, isTeacher }: { session: Session; isTeacher: boolean }) {
  const [joined, setJoined] = useState(false);
  const [hands, setHands] = useState<Hand[]>([]);
  const [mineRaised, setMineRaised] = useState(false);
  const [msg, setMsg] = useState("");

  async function join() {
    setJoined(true);
    if (!isTeacher) {
      try {
        await fetch("/api/live", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attend: session.id }),
        });
      } catch {}
    }
  }

  async function loadHands() {
    if (!isTeacher) return;
    try {
      const r = await fetch(`/api/live?hands=${session.id}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setHands(j.hands ?? []);
    } catch {}
  }

  useEffect(() => {
    if (!joined || !isTeacher) return;
    loadHands();
    const t = setInterval(loadHands, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);

  async function raise() {
    const r = await fetch("/api/live", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "raise", session_id: session.id }),
    });
    if (r.ok) setMineRaised(true);
  }

  async function lower(userId?: string) {
    const r = await fetch("/api/live", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lower", session_id: session.id, user_id: userId }),
    });
    if (r.ok) {
      if (!isTeacher) setMineRaised(false);
      else loadHands();
    }
  }

  if (!joined) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-6 text-center">
        <div className="text-5xl">🔴</div>
        <h1 className="text-h1" dir="auto">{session.title}</h1>
        <p className="text-small text-slate-500">{new Date(session.starts_at).toLocaleString("ar-EG")}</p>
        <button onClick={join} className="btn-primary w-full !py-3 text-base">
          دخول الغرفة 🚪
        </button>
        <p className="text-xs text-slate-400">
          {session.provider === "jitsi"
            ? "ستعمل الكاميرا والمايك داخل الموقع — المعلم يدخل أولاً ليكون مشرفاً."
            : "ستُفتح الغرفة الخارجية في تبويب جديد."}
        </p>
        {msg && <div className="text-xs font-bold text-primary">{msg}</div>}
      </main>
    );
  }

  if (session.provider !== "jitsi") {
    return (
      <main className="mx-auto max-w-md space-y-4 p-6 text-center">
        <h1 className="text-h1" dir="auto">{session.title}</h1>
        <a href={session.ext_url} target="_blank" rel="noreferrer" className="btn-primary w-full !py-3 text-base">
          فتح الغرفة {session.provider === "zoom" ? "في زوم 🔵" : "الخارجية 🔗"}
        </a>
        {!isTeacher && !mineRaised && (
          <button onClick={raise} className="btn-secondary w-full">✋ رفع يد</button>
        )}
        {!isTeacher && mineRaised && (
          <button onClick={() => lower()} className="btn-secondary w-full">إنزال اليد ✋</button>
        )}
        {isTeacher && <HandsPanel hands={hands} onLower={(uid) => lower(uid)} />}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-h1" dir="auto">🔴 {session.title}</h1>
        <span className="rounded-full bg-danger/10 px-3 py-1 text-xs font-bold text-danger">بث مباشر</span>
      </header>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black" style={{ height: "min(62vh, 560px)" }}>
        <iframe
          title={session.title}
          src={`https://meet.jit.si/${session.room}`}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className="h-full w-full"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="card space-y-2 p-4">
          <h2 className="font-bold text-small">للطالب 🙋</h2>
          {!isTeacher && !mineRaised && (
            <button onClick={raise} className="btn-secondary w-full !py-2.5 text-small">✋ عندي سؤال — رفع يد</button>
          )}
          {!isTeacher && mineRaised && (
            <button onClick={() => lower()} className="btn-secondary w-full !py-2.5 text-small">تمام، نزلت إيدي ✅</button>
          )}
          {isTeacher && <p className="text-xs text-slate-400">ادخل الغرفة أولاً لتصبح مشرفاً (كتم/طرد من داخل Jitsi).</p>}
        </div>
        {isTeacher && <HandsPanel hands={hands} onLower={(uid) => lower(uid)} />}
      </div>
    </main>
  );
}

function HandsPanel({ hands, onLower }: { hands: Hand[]; onLower: (uid: string) => void }) {
  return (
    <div className="card space-y-2 p-4">
      <h2 className="font-bold text-small">الأيدي المرفوعة ✋ ({hands.length})</h2>
      {hands.length === 0 ? (
        <div className="text-xs text-slate-400">لا أحد رافع إيده.</div>
      ) : (
        <ul className="space-y-1.5">
          {hands.map((h) => (
            <li key={h.student_id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-small">
              <span className="font-bold">{h.name || "طالب"}</span>
              <button onClick={() => onLower(h.student_id)} className="text-xs font-bold text-success">تم الرد ✅</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
