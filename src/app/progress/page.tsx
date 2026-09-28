"use client";

import { useEffect, useState } from "react";
import { PushSubscribeButton } from "@/components/PushSubscribeButton";

type Progress = {
  ok: boolean;
  student: { name: string };
  billing: { paid: number; expected: number; outstanding: number; pay_numbers: Record<string, string> };
  stats: { exams_taken: number; avg_score: number | null; certificates: number };
  attempts: { id: string; exam_title: string; score: number; total: number; submitted_at: string }[];
  certificates: { serial_code: string; title: string; score: number; created_at: string }[];
  groups: { id: string; name: string; subject: string | null }[];
  videos: { id: string; title: string; visibility: string }[];
};

const PAY_LABELS: Record<string, string> = { instapay: "انستاباي", wallet: "محفظة", fawry: "فوري" };

function StoreCatalog() {
  const [items, setItems] = useState<{ id: string; title: string; description: string | null; price: number; my_status: string | null; my_order_id: string | null }[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  async function load() {
    try {
      const r = await fetch("/api/store", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setItems(j.products ?? []);
    } catch {}
  }
  useEffect(() => { load(); }, []);
  async function order(id: string) {
    setBusy(id); setMsg("");
    try {
      const r = await fetch(`/api/store/${id}/order`, { method: "POST" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setMsg(j.status === "confirmed" ? "أصبح المنتج لك ✅ — حمّله الآن." : "تم إرسال طلبك — بانتظار تأكيد المعلم.");
        load();
      } else setMsg(j?.message ?? "فشل الطلب.");
    } catch { setMsg("تعذر الاتصال."); }
    finally { setBusy(null); }
  }
  async function download(id: string) {
    try {
      const r = await fetch(`/api/store/download/${id}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) window.open(j.url, "_blank", "noopener");
      else setMsg(j?.message ?? "تعذر التحميل.");
    } catch { setMsg("تعذر الاتصال."); }
  }
  if (!items?.length) return null;
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-bold">متجر السنتر 🛍️</h2>
      {msg && <p className="text-small font-bold text-primary">{msg}</p>}
      <ul className="space-y-2">
        {items.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
            <span><b>{p.title}</b> · {Number(p.price) <= 0 ? "مجاني" : `${p.price} جنيه`}</span>
            {!p.my_status ? (
              <button onClick={() => order(p.id)} disabled={busy === p.id} className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white disabled:opacity-50">
                {busy === p.id ? "..." : Number(p.price) <= 0 ? "احصل عليه" : "اطلب"}
              </button>
            ) : p.my_status === "confirmed" && p.my_order_id ? (
              <button onClick={() => download(p.my_order_id!)} className="rounded-lg bg-success/10 px-3 py-1 text-xs font-bold text-success">تحميل ⬇️</button>
            ) : p.my_status === "pending" ? (
              <span className="text-xs font-bold text-warning">بانتظار التأكيد</span>
            ) : (
              <button onClick={() => order(p.id)} className="rounded-lg bg-primary-light px-3 py-1 text-xs font-bold text-primary">اطلب مجدداً</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AnnouncementsFeed() {
  const [items, setItems] = useState<{ id: string; group_name: string; body: string; created_at: string | null }[] | null>(null);
  useEffect(() => {
    fetch("/api/announcements", { cache: "no-store" })
      .then((r) => r.json()).then((j) => { if (j?.ok) setItems((j.announcements ?? []).slice(0, 5)); }).catch(() => {});
  }, []);
  if (!items?.length) return null;
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-bold">إعلانات السنتر 📢</h2>
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id} className="rounded-xl bg-primary-light/50 px-4 py-2.5 text-small">
            <div className="leading-relaxed">{a.body}</div>
            <div className="mt-1 text-[11px] text-slate-500">{a.group_name}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

type Game = {
  me: { name: string; streak: number; activeDays: number; points: number; trophies: { code: string; name: string; icon: string; desc: string }[] };
  leaders: { name: string; points: number; me: boolean }[];
};

type MyPlan = { rank: number | null; of: number; groupAvg: number | null; myPts: number; groupName: string | null; lessons: { subject: string; lesson: string }[]; steps: string[] };

/** خطتي الأسبوعية: ترتيبي + متوسط مجموعتي + دروسي المتأخرة */
function MyPlanSection() {
  const [p, setP] = useState<MyPlan | null>(null);
  useEffect(() => {
    fetch("/api/me/plan", { cache: "no-store" })
      .then((r) => r.json()).then((j) => { if (j?.ok) setP(j); }).catch(() => {});
  }, []);
  if (!p) return null;
  return (
    <section className="card space-y-3 border-primary/20 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">خطتي هذا الأسبوع 🗺️</h2>
        {p.rank !== null && (
          <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-bold text-primary">
            ترتيبك #{p.rank} من {p.of}{p.groupAvg !== null ? ` · متوسط المجموعة ${p.groupAvg} نقطة (نقاطك ${p.myPts})` : ""}
          </span>
        )}
      </div>
      {p.groupAvg !== null && p.rank !== null && p.rank > Math.ceil(p.of / 2) && (
        <div className="rounded-xl bg-warning/10 p-3 text-small font-bold text-warning">
          ⚠️ أنت تحت متوسط مجموعتك — ركز على الدروس بالأسفل لتتقدم هذا الأسبوع.
        </div>
      )}
      <ul className="space-y-1 text-small text-slate-600">
        {p.steps.map((s, i) => <li key={i}>• {s}</li>)}
      </ul>
    </section>
  );
}

/** قيّم حصص اليوم (1-5) — مرة واحدة لكل حصة خلال 48 ساعة */
function RateTodaySection() {
  const [list, setList] = useState<{ id: string; topic: string | null; group: string }[]>([]);
  const [done, setDone] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/sessions/rate", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setList(j.sessions ?? []);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function rate(id: string, score: number) {
    try {
      const r = await fetch("/api/sessions/rate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: id, score }),
      });
      if (r.ok) { setDone(true); load(); setTimeout(() => setDone(false), 3000); }
    } catch {}
  }

  if (!list.length) return null;
  return (
    <section className="card space-y-2 p-5">
      <h2 className="font-bold">قيّم حصص اليوم ⭐</h2>
      {done && <div className="text-xs font-bold text-success">شكراً — رأيك وصل لمعلمك ✅</div>}
      {list.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5">
          <span className="text-small font-bold">{s.group}{s.topic ? ` · ${s.topic}` : ""}</span>
          <div className="flex gap-1" dir="ltr">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => rate(s.id, n)} className="h-8 w-8 rounded-lg bg-white text-small shadow-sm transition hover:bg-warning hover:text-white">★</button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/** اسأل معلمك + حالة مطالبات الدفع */
function AskAndClaims() {
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [tid, setTid] = useState("");
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [claims, setClaims] = useState<{ id: string; amount: number; method: string; status: string; paid_at: string }[]>([]);

  useEffect(() => {
    fetch("/api/me/teachers").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setTeachers(j.teachers);
    }).catch(() => {});
    fetch("/api/payments/claim").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setClaims(j.claims);
    }).catch(() => {});
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!tid || !text.trim()) return;
    try {
      const r = await fetch("/api/dm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id: tid, body: text }),
      });
      if (r.ok) { setText(""); setSent(true); setTimeout(() => setSent(false), 4000); }
    } catch {}
  }

  const ST: Record<string, string> = { pending: "بانتظار المراجعة ⏳", confirmed: "مؤكدة ✅", rejected: "مرفوضة" };
  return (
    <section className="card grid gap-4 p-5 lg:grid-cols-2">
      <div className="space-y-2">
        <h2 className="font-bold">اسأل معلمك 💬</h2>
        {teachers.length === 0 ? <div className="text-small text-slate-400">لا معلمين مرتبطين بمجموعاتك.</div> : (
          <form onSubmit={send} className="space-y-2">
            <select value={tid} onChange={(e) => setTid(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-small">
              <option value="">اختر المعلم…</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000}
              placeholder="اكتب سؤالك..." className="w-full rounded-xl border border-slate-200 px-4 py-2 text-small" />
            <button className="btn-primary !py-2 text-small">إرسال</button>
            {sent && <div className="text-xs font-bold text-success">وصلت رسالتك ✅</div>}
          </form>
        )}
      </div>
      <div className="space-y-2">
        <h2 className="font-bold">مطالبات الدفع 🧾</h2>
        {claims.length === 0 ? <div className="text-small text-slate-400">لا مطالبات مسجلة.</div> :
          claims.slice(0, 5).map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-small">
              <span className="font-bold">{Number(c.amount).toLocaleString("ar-EG")} ج <span className="font-normal text-slate-400">· {c.method}</span></span>
              <span className="text-xs font-bold">{ST[c.status] ?? c.status}</span>
            </div>
          ))}
      </div>
    </section>
  );
}

function GamificationSection() {
  const [g, setG] = useState<Game | null>(null);
  useEffect(() => {
    fetch("/api/me/gamification", { cache: "no-store" })
      .then((r) => r.json()).then((j) => { if (j?.ok) setG(j); }).catch(() => {});
  }, []);
  if (!g) return null;
  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">رحلتي 🏆</h2>
        <div className="flex gap-2 text-small">
          <span className="rounded-full bg-danger/10 px-3 py-1 font-bold text-danger">🔥 {g.me.streak} أيام متتالية</span>
          <span className="rounded-full bg-primary-light px-3 py-1 font-bold text-primary">⭐ {g.me.points} نقطة</span>
        </div>
      </div>
      {g.me.trophies.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {g.me.trophies.map((t) => (
            <span key={t.code} title={t.desc} className="rounded-xl bg-warning/10 px-3 py-1.5 text-small font-bold">
              {t.icon} {t.name}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-small text-slate-500">أول وسام بانتظارك — سلّم واجباً أو احضر حصتك 🌱</p>
      )}
      {g.leaders.length > 1 && (
        <div>
          <h3 className="mb-2 text-small font-bold text-slate-500">المتصدرون 🚀</h3>
          <ul className="space-y-1.5">
            {g.leaders.slice(0, 5).map((l, i) => (
              <li key={i} className={`flex items-center justify-between rounded-xl px-4 py-2 text-small ${l.me ? "bg-primary-light font-bold text-primary" : "bg-slate-50"}`}>
                <span>{["🥇", "🥈", "🥉", "4.", "5."][i]} {l.name}{l.me ? " (أنت)" : ""}</span>
                <span>{l.points} نقطة</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

type Hw = {
  id: string; group_name: string | null; title: string; description: string | null;
  due_at: string | null; max_score: number; overdue: boolean;
  submission: { score: number | null; feedback_text: string | null; status: string; submitted_at: string } | null;
};

function HomeworkSection() {
  const [items, setItems] = useState<Hw[] | null>(null);
  const [files, setFiles] = useState<Record<string, FileList | null>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/me/assignments", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setItems(j.assignments ?? []);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function submit(id: string) {
    const fl = files[id];
    const tx = (answers[id] ?? "").trim();
    if (!fl?.length && !tx) { setMsg("اختر صور الحل أو اكتب الإجابة النصية أولاً."); return; }
    setBusy(id); setMsg("");
    try {
      const fd = new FormData();
      if (fl?.length) Array.from(fl).slice(0, 5).forEach((f) => fd.append("files", f));
      if (tx) fd.append("answer_text", tx);
      const r = await fetch(`/api/me/assignments/${id}/submit`, { method: "POST", body: fd });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setMsg(j.late ? "تم التسليم (متأخر) ✅" : "تم التسليم ✅");
        setFiles((p) => ({ ...p, [id]: null }));
        setAnswers((p) => ({ ...p, [id]: "" }));
        load();
      } else setMsg(j?.message ?? "فشل التسليم: " + (j?.error ?? ""));
    } catch { setMsg("تعذر الاتصال بالخادم."); }
    finally { setBusy(null); }
  }

  if (items === null) return null;
  if (!items.length) return null;
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-bold">واجباتي 📝</h2>
      {msg && <p className="text-small font-bold text-primary">{msg}</p>}
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id} className="rounded-xl bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-small">
              <span className="font-bold">{a.title}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${a.submission?.status === "graded" ? "bg-success/10 text-success" : a.submission ? "bg-primary-light text-primary" : a.overdue ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>
                {a.submission?.status === "graded"
                  ? `مصحح ${a.submission.score}/${a.max_score}`
                  : a.submission ? "تم التسليم ✓" : a.overdue ? "متأخر!" : "جديد"}
              </span>
            </div>
            {a.description && <p className="mt-1 text-xs text-slate-500">{a.description}</p>}
            <div className="mt-1 text-xs text-slate-500">
              {a.group_name ?? ""}{a.due_at ? ` · التسليم: ${new Date(a.due_at).toLocaleString("ar-EG")}` : ""}
            </div>
            {a.submission?.status === "graded" && a.submission.feedback_text && (
              <p className="mt-1 rounded-lg bg-success/10 p-2 text-xs">ملاحظة المعلم: {a.submission.feedback_text}</p>
            )}
            {(!a.submission || a.submission.status !== "graded") && (
              <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-500 hover:border-primary hover:text-primary">
                {files[a.id]?.length ? `📎 ${files[a.id]!.length} صور` : "صوّر الحل وارفع الصور"}
                <input type="file" accept="image/*,.pdf" multiple className="hidden"
                  onChange={(e) => setFiles((p) => ({ ...p, [a.id]: e.target.files }))} />
              </label>
            )}
            {files[a.id]?.length ? (
              <button onClick={() => submit(a.id)} disabled={busy === a.id}
                className="btn-primary mt-2 w-full !py-2 text-small" >
                {busy === a.id ? "جاري الرفع..." : "تسليم الواجب"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** الشكاوى والمقترحات: إرسال للطالب + متابعة الرد */
function ComplaintsSection() {
  type Row = { id: string; kind: string; body: string; status: string; reply: string };
  const [rows, setRows] = useState<Row[]>([]);
  const [kind, setKind] = useState("complaint");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");
  async function load() {
    try {
      const r = await fetch("/api/complaints", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok && !j.isTeacher) setRows(j.rows ?? []);
    } catch {}
  }
  useEffect(() => { load(); }, []);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/complaints", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, body }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) { setBody(""); setMsg("وصلتنا رسالتك ✅"); load(); }
    else setMsg(j?.error === "too_short" ? "اكتب تفاصيل أكثر." : "فشل الإرسال.");
  }
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-bold">شكاوى ومقترحات 📮</h2>
      <form onSubmit={send} className="space-y-2">
        <select value={kind} onChange={(e) => setKind(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-small">
          <option value="complaint">شكوى 😟</option>
          <option value="suggestion">اقتراح 💡</option>
        </select>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={1000}
          placeholder="احكِ لنا..." className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-small" />
        <button className="btn-primary !py-2 text-small">إرسال</button>
      </form>
      {msg && <div className="text-xs font-bold text-primary">{msg}</div>}
      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.slice(0, 5).map((c) => (
            <li key={c.id} className="rounded-xl bg-slate-50 px-4 py-2.5 text-small">
              <div className="flex justify-between gap-2">
                <span>{c.kind === "suggestion" ? "💡" : "😟"}</span>
                <span className={`text-xs font-bold ${c.status === "resolved" ? "text-success" : "text-warning"}`}>
                  {c.status === "resolved" ? "تم الرد" : "قيد المراجعة"}
                </span>
              </div>
              <div dir="auto" className="mt-1">{c.body}</div>
              {c.reply && <div dir="auto" className="mt-1 rounded-lg bg-success/10 px-3 py-1.5 text-xs">رد الإدارة: {c.reply}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** الفعاليات القادمة: تسجيل الطالب (+ فاتورة إن برسوم) */
function EventsSection() {
  type Ev = { id: string; title: string; event_at: string; fee: number; capacity: number };
  const [events, setEvents] = useState<Ev[]>([]);
  const [mine, setMine] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  async function load() {
    try {
      const r = await fetch("/api/events", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok && !j.isTeacher) { setEvents(j.events ?? []); setMine(j.mine ?? []); }
    } catch {}
  }
  useEffect(() => { load(); }, []);
  async function register(event_id: string, fee: number) {
    if (!confirm(fee > 0 ? `التسجيل برسوم ${fee} ج؟ ستضاف فاتورة.` : "تأكيد التسجيل؟")) return;
    const r = await fetch("/api/events", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_id }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) { setMsg("تم تسجيلك ✅"); load(); }
    else setMsg(j?.error === "full" ? "اكتمل العدد." : j?.error === "already" ? "مسجل فيها." : "فشل التسجيل.");
  }
  if (!events.length) return null;
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-bold">فعاليات قادمة 🎪</h2>
      {msg && <div className="text-xs font-bold text-primary">{msg}</div>}
      <ul className="space-y-2">
        {events.slice(0, 5).map((v) => (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
            <span><b>{v.title}</b> — {new Date(v.event_at).toLocaleString("ar-EG")} · {v.fee > 0 ? `${v.fee} ج` : "مجاناً"}</span>
            {mine.includes(v.id) ? <span className="text-xs font-bold text-success">مسجل ✅</span> :
              <button onClick={() => register(v.id, v.fee)} className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white">سجلني</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ProgressPage() {
  const [data, setData] = useState<Progress | null>(null);
  const [err, setErr] = useState("");
  const [claim, setClaim] = useState({ amount: "", method: "instapay", reference: "" });
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimMsg, setClaimMsg] = useState("");

  async function onClaim(e: React.FormEvent) {
    e.preventDefault();
    setClaimBusy(true); setClaimMsg("");
    try {
      const r = await fetch("/api/payments/claim", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...claim, amount: Number(claim.amount) }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setClaimMsg("تم إرسال بلاغ الدفع — سيؤكده المعلم قريباً ✅");
        setClaim({ amount: "", method: "instapay", reference: "" });
      } else setClaimMsg(j?.message ?? "فشل الإرسال: " + (j?.error ?? "خطأ غير معروف"));
    } catch { setClaimMsg("تعذر الاتصال بالخادم."); }
    setClaimBusy(false);
  }

  useEffect(() => {
    fetch("/api/me/progress")
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (r.ok && j?.ok) setData(j);
        else setErr(j?.error === "unauth" ? "سجّل دخولك أولاً لعرض تقدمك." : "تعذر تحميل بيانات التقدم.");
      })
      .catch(() => setErr("تعذر الاتصال بالخادم."));
  }, []);

  if (err) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-8 text-center">
        <div className="text-h1">📊</div>
        <p className="font-bold">{err}</p>
        <a href="/login" className="btn-primary inline-block">تسجيل الدخول</a>
        <div><a href="/parent" className="mt-2 inline-block text-small font-bold text-primary underline">ولي أمر؟ ادخل برقم موبايل الطالب ←</a></div>
      </div>
    );
  }
  if (!data) return <div className="mx-auto max-w-3xl p-8 text-center text-slate-400">جاري تحميل تقدمك...</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <header>
        <h1 className="text-h1">تقدمي الدراسي 🎯</h1>
        <p className="mt-1 text-small text-slate-500">أهلاً {data.student.name} — كل نتائجك وشهاداتك في مكان واحد</p>
      </header>

      <section className="card p-4">
        <PushSubscribeButton />
      </section>

      <div className="grid grid-cols-3 gap-3">
        {[
          ["امتحانات", data.stats.exams_taken],
          ["متوسط الدرجات", data.stats.avg_score ?? "—"],
          ["شهادات", data.stats.certificates],
        ].map(([label, val]) => (
          <div key={label as string} className="card p-4 text-center">
            <div className="text-h1 font-extrabold text-primary">{val}</div>
            <div className="mt-1 text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {data.certificates.length > 0 && (
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">شهاداتي 🎓</h2>
          <ul className="space-y-2">
            {data.certificates.map((c) => (
              <li key={c.serial_code} className="flex items-center justify-between gap-3 rounded-xl bg-success/5 px-4 py-2.5 text-small">
                <span className="font-bold">{c.title}</span>
                <a href={`/verify/${c.serial_code}`} className="font-mono text-xs font-bold text-primary" dir="ltr">{c.serial_code}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <HomeworkSection />
      <AskAndClaims />
      <RateTodaySection />
      <MyPlanSection />
      <GamificationSection />
      <AnnouncementsFeed />
      <StoreCatalog />
      <ComplaintsSection />
      <EventsSection />

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">نتائج الامتحانات 📝</h2>
        {data.attempts.length === 0 ? (
          <p className="text-small text-slate-500">لم تؤدِ أي امتحان بعد.</p>
        ) : (
          <ul className="space-y-2">
            {data.attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
                <span className="font-bold">{a.exam_title}</span>
                <span className="text-slate-600">
                  {a.score}/{a.total} · {new Date(a.submitted_at).toLocaleDateString("ar-EG")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.billing && (
        <section className="card space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">اشتراكي الشهري 💳</h2>
            <div className="text-small">
              مدفوع: <b className="text-success">{data.billing.paid}</b>
              {" · "}المتبقي: <b className={data.billing.outstanding > 0 ? "text-danger" : "text-success"}>{data.billing.outstanding} جنيه</b>
            </div>
          </div>
          {data.billing.outstanding > 0 && (
            <>
              {Object.keys(data.billing.pay_numbers ?? {}).length > 0 && (
                <div className="rounded-xl bg-slate-50 p-3 text-small">
                  <div className="mb-1 text-xs font-bold text-slate-500">حوّل على أحد الأرقام التالية ثم أبلغنا:</div>
                  {Object.entries(data.billing.pay_numbers).map(([k, v]) => (
                    <div key={k} className="flex justify-between py-0.5">
                      <span>{PAY_LABELS[k] ?? k}</span>
                      <span className="font-mono font-bold" dir="ltr">{v}</span>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={onClaim} className="grid gap-2 sm:grid-cols-4">
                <input value={claim.amount} onChange={(e) => setClaim({ ...claim, amount: e.target.value })}
                  placeholder="المبلغ" inputMode="decimal" required className="rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-primary" />
                <select value={claim.method} onChange={(e) => setClaim({ ...claim, method: e.target.value })}
                  className="rounded-xl border border-slate-200 px-4 py-2">
                  <option value="instapay">انستاباي</option>
                  <option value="wallet">محفظة</option>
                  <option value="fawry">فوري</option>
                  <option value="card">بطاقة</option>
                </select>
                <input value={claim.reference} onChange={(e) => setClaim({ ...claim, reference: e.target.value })}
                  placeholder="رقم العملية" required className="rounded-xl border border-slate-200 px-4 py-2 outline-none focus:border-primary" />
                <button className="btn-primary !py-2 text-small" disabled={claimBusy}>{claimBusy ? "جاري..." : "أبلغت بالدفع"}</button>
              </form>
              {claimMsg && <p className="text-small font-bold text-primary">{claimMsg}</p>}
            </>
          )}
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">مجموعاتي 👥</h2>
          {data.groups.length === 0 ? (
            <p className="text-small text-slate-500">غير مسجل في مجموعات بعد.</p>
          ) : (
            <ul className="space-y-2">
              {data.groups.map((g) => (
                <li key={g.id} className="rounded-xl bg-slate-50 px-4 py-2.5 text-small font-bold">
                  {g.name}{g.subject ? ` · ${g.subject}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">فيديوهاتي 🎬</h2>
          {data.videos.length === 0 ? (
            <p className="text-small text-slate-500">لا توجد فيديوهات متاحة بعد.</p>
          ) : (
            <ul className="space-y-2">
              {data.videos.slice(0, 8).map((v) => (
                <li key={v.id}>
                  <a href={`/watch/${v.id}`} className="block rounded-xl bg-slate-50 px-4 py-2.5 text-small font-bold text-primary transition hover:bg-primary-light">
                    ▶ {v.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
