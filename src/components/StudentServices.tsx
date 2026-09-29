"use client";

import { useEffect, useState } from "react";

/** خدمات الطالب في /progress (اللوحة للمعلمين فقط): نقاط/باقات/مكتبة/شحن/مواصلات/مشاريع/منتدى/مذكرات */
function useSvc(url: string) {
  const [data, setData] = useState<any>(null);
  const load = async () => {
    try {
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok && !j.isTeacher) setData(j);
    } catch {}
  };
  useEffect(() => { load(); }, [url]);
  return { data, load };
}

export function StudentPoints() {
  const { data, load } = useSvc("/api/points/rewards");
  const [msg, setMsg] = useState("");
  if (!data) return null;
  async function redeem(reward_id: string) {
    if (!confirm("استبدال نقاطك؟")) return;
    const r = await fetch("/api/points/rewards", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reward_id }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) { setMsg(`تم! رصيدك ${j.balance}`); load(); }
    else setMsg(j?.error === "no_balance" ? "رصيدك لا يكفي." : "فشل.");
  }
  return (
    <section className="card space-y-2 p-5">
      <div className="flex items-center justify-between"><h2 className="font-bold">متجر النقاط 🎁</h2>
        <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-bold text-warning">رصيدك: {data.balance}</span></div>
      {msg && <div className="text-xs font-bold text-primary">{msg}</div>}
      {(data.rewards ?? []).slice(0, 5).map((w: any) => (
        <div key={w.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2 text-small">
          <span><b>{w.title}</b> — {w.cost_points} نقطة</span>
          <button onClick={() => redeem(w.id)} disabled={data.balance < w.cost_points}
            className="rounded-lg bg-warning px-3 py-1 text-xs font-bold text-white disabled:opacity-40">استبدال</button>
        </div>
      ))}
    </section>
  );
}

export function StudentBundles() {
  const { data, load } = useSvc("/api/bundles");
  const [msg, setMsg] = useState("");
  if (!data) return null;
  async function subscribe(bundle_id: string) {
    if (!confirm("اشترك؟ ستضاف فاتورة الشهر.")) return;
    const r = await fetch("/api/bundles", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bundle_id }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) { setMsg("تم الاشتراك ✅"); load(); }
    else setMsg(j?.error === "already" ? "مشترك فيها." : "فشل.");
  }
  return (
    <section className="card space-y-2 p-5">
      <h2 className="font-bold">باقات المواد 📦</h2>
      {msg && <div className="text-xs font-bold text-primary">{msg}</div>}
      {(data.bundles ?? []).slice(0, 5).map((b: any) => (
        <div key={b.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2 text-small">
          <span><b>{b.title}</b> — {b.price} ج/شهر</span>
          {(data.mine ?? []).includes(b.id)
            ? <span className="text-xs font-bold text-success">مشترك ✅</span>
            : <button onClick={() => subscribe(b.id)} className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white">اشترك</button>}
        </div>
      ))}
    </section>
  );
}

export function StudentLibrary() {
  const { data, load } = useSvc("/api/library");
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  if (!data) return null;
  const owned: string[] = data.owned ?? [];
  async function buy(item_id: string, price: number) {
    if (!confirm(price > 0 ? `شراء بـ${price} ج؟` : "فتح؟")) return;
    const r = await fetch("/api/library", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_id }),
    });
    if (r.ok) { setMsg("تم ✅"); load(); } else setMsg("فشل الشراء.");
  }
  return (
    <section className="card space-y-2 p-5">
      <h2 className="font-bold">المكتبة 📚</h2>
      {msg && <div className="text-xs font-bold text-primary">{msg}</div>}
      {(data.items ?? []).slice(0, 5).map((t: any) => (
        <div key={t.id} className="rounded-xl bg-slate-50 px-4 py-2 text-small">
          <div className="flex items-center justify-between gap-2">
            <span><b>{t.title}</b> — {t.price > 0 ? `${t.price} ج` : "مجاناً"}</span>
            {owned.includes(t.id)
              ? <button onClick={() => setOpen(open === t.id ? null : t.id)} className="rounded-lg bg-success px-3 py-1 text-xs font-bold text-white">قراءة 📖</button>
              : <button onClick={() => buy(t.id, t.price)} className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white">شراء</button>}
          </div>
          {open === t.id && owned.includes(t.id) && (
            <div dir="auto" className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3">{(data.contents ?? {})[t.id] || "—"}</div>
          )}
        </div>
      ))}
    </section>
  );
}

export function StudentShipments() {
  const { data, load } = useSvc("/api/shipments");
  const [form, setForm] = useState({ governorate: "", address: "", items: "" });
  const [msg, setMsg] = useState("");
  if (!data) return null;
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/shipments", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    if (r.ok) { setForm({ governorate: "", address: "", items: "" }); setMsg("تم ✅"); load(); } else setMsg("فشل.");
  }
  return (
    <section className="card space-y-2 p-5">
      <h2 className="font-bold">شحن المذكرات 🚚</h2>
      <form onSubmit={create} className="grid gap-2">
        <input value={form.governorate} onChange={(e) => setForm({ ...form, governorate: e.target.value })} placeholder="المحافظة" required maxLength={60} className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
        <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="العنوان" required maxLength={300} className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
        <input value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} placeholder="المطلوب" required maxLength={500} className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
        <button className="btn-primary !py-2 text-small">طلب الشحن</button>
      </form>
      {msg && <div className="text-xs font-bold text-primary">{msg}</div>}
      {(data.rows ?? []).slice(0, 3).map((s: any) => (
        <div key={s.id} className="rounded-xl bg-slate-50 px-4 py-2 text-small">{s.governorate} · {s.status_label}</div>
      ))}
    </section>
  );
}

export function StudentTransport() {
  const { data, load } = useSvc("/api/transport");
  const [msg, setMsg] = useState("");
  if (!data) return null;
  async function subscribe(route_id: string, fee: number) {
    if (!confirm(fee > 0 ? `اشتراك بـ${fee} ج؟` : "تأكيد؟")) return;
    const r = await fetch("/api/transport", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "subscribe", route_id }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) { setMsg("تم ✅"); load(); } else setMsg(j?.error === "already" ? "مشترك." : "فشل.");
  }
  return (
    <section className="card space-y-2 p-5">
      <h2 className="font-bold">المواصلات 🚌</h2>
      {msg && <div className="text-xs font-bold text-primary">{msg}</div>}
      {(data.routes ?? []).slice(0, 5).map((t: any) => (
        <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2 text-small">
          <span><b>{t.name}</b> — {t.fee > 0 ? `${t.fee} ج/شهر` : "مجاناً"}</span>
          {(data.mine ?? []).includes(t.id)
            ? <span className="text-xs font-bold text-success">مشترك ✅</span>
            : <button onClick={() => subscribe(t.id, t.fee)} className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white">اشترك</button>}
        </div>
      ))}
    </section>
  );
}

export function StudentProjects() {
  const { data, load } = useSvc("/api/projects");
  const [form, setForm] = useState({ title: "", description: "", link: "" });
  const [msg, setMsg] = useState("");
  if (!data) return null;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/projects", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    if (r.ok) { setForm({ title: "", description: "", link: "" }); setMsg("تم التقديم ✅"); load(); } else setMsg("فشل.");
  }
  return (
    <section className="card space-y-2 p-5">
      <h2 className="font-bold">مشروعي 🚀</h2>
      <form onSubmit={submit} className="grid gap-2">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="اسم المشروع" required maxLength={150} className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
        <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="رابط (اختياري)" dir="ltr" maxLength={500} className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
        <button className="btn-primary !py-2 text-small">تقديم</button>
      </form>
      {msg && <div className="text-xs font-bold text-primary">{msg}</div>}
      {(data.rows ?? []).filter((p: any) => p.status !== "approved" || !p.featured).slice(0, 3).map((p: any) => (
        <div key={p.id} className="rounded-xl bg-slate-50 px-4 py-2 text-small"><b>{p.title}</b> — {p.status === "approved" ? "معتمد ✅" : p.status === "rejected" ? "مرفوض" : "قيد المراجعة ⏳"}</div>
      ))}
    </section>
  );
}

export function StudentForum() {
  const [threads, setThreads] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  async function load() {
    try {
      const r = await fetch("/api/forum?page=1", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setThreads(j.threads ?? []);
    } catch {}
  }
  useEffect(() => { load(); }, []);
  async function open(id: string) {
    setOpenId(id); setMsgs([]);
    try {
      const r = await fetch(`/api/forum/${id}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setMsgs(j.messages ?? []);
    } catch {}
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!openId || !reply.trim()) return;
    const r = await fetch(`/api/forum/${openId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: reply }),
    });
    if (r.ok) { setReply(""); open(openId); }
  }
  if (!threads.length) return null;
  return (
    <section className="card space-y-2 p-5">
      <h2 className="font-bold">المنتدى 💬</h2>
      {threads.slice(0, 5).map((t: any) => (
        <button key={t.id} onClick={() => open(t.id)} className="block w-full rounded-xl bg-slate-50 px-4 py-2 text-right text-small">
          <b dir="auto">{t.first?.body.split("\n")[0].replace(/\*\*/g, "") ?? ""}</b>
          <span className="mr-2 text-xs text-slate-400">{t.replies} رد</span>
        </button>
      ))}
      {openId && (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          {msgs.slice(-5).map((m: any) => (
            <div key={m.id} className="text-small" dir="auto">{m.body}</div>
          ))}
          <form onSubmit={send} className="flex gap-2">
            <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="رد..." maxLength={2000} className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-small" />
            <button className="btn-primary !px-4 !py-1.5 text-xs">إرسال</button>
          </form>
        </div>
      )}
    </section>
  );
}

export function StudentNotes() {
  const [notes, setNotes] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/notes", { cache: "no-store" }).then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setNotes(j.notes ?? []);
    }).catch(() => {});
  }, []);
  if (!notes.length) return null;
  return (
    <section className="card space-y-2 p-5">
      <h2 className="font-bold">مذكرات 📝</h2>
      {notes.slice(0, 5).map((n: any) => (
        <div key={n.id} className="rounded-xl bg-slate-50 px-4 py-2 text-small">
          <b dir="auto">{n.title}</b> <span className="text-xs text-slate-400">({n.subject})</span>
        </div>
      ))}
    </section>
  );
}
