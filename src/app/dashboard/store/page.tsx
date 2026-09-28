"use client";

import { useEffect, useState } from "react";

type Product = { id: string; title: string; description: string | null; price: number; is_active: boolean; stock_qty?: number; low_stock_at?: number; subject?: string; lesson?: string };
type PosLine = { product_id: string; qty: number };
type Order = { id: string; status: string; created_at: string; student_name: string; products: { title: string; price: number } };

type Reward = { id: string; title: string; cost_points: number; stock: number; active: boolean };
type Redemption = { id: string; title: string; student: string; status: string; created_at: string };

/** متجر النقاط: استبدال الرصيد بمكافآت (طالب) + إدارة وتسليم (معلم) */
function PointsSection() {
  const [isTeacher, setIsTeacher] = useState(false);
  const [balance, setBalance] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [reds, setReds] = useState<Redemption[]>([]);
  const [mine, setMine] = useState<{ id: string; reward_id: string; status: string }[]>([]);
  const [form, setForm] = useState({ title: "", cost: "", stock: "" });
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/points/rewards", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setIsTeacher(!!j.isTeacher); setBalance(j.balance ?? 0);
        setRewards(j.rewards ?? []); setReds(j.redemptions ?? []); setMine(j.mine ?? []);
      }
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/points/rewards", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.title, cost_points: Number(form.cost), stock: form.stock === "" ? -1 : Number(form.stock) }),
    });
    if (r.ok) { setForm({ title: "", cost: "", stock: "" }); load(); }
  }

  async function redeem(reward_id: string) {
    if (!confirm("استبدال نقاطك بهذه المكافأة؟")) return;
    const r = await fetch("/api/points/rewards", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reward_id }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok) { setMsg(`تم! رصيدك الآن ${j.balance} نقطة.`); load(); }
    else setMsg(j?.error === "no_balance" ? "رصيدك لا يكفي." : j?.error === "out_of_stock" ? "نفدت الكمية." : "فشل الاستبدال.");
  }

  async function deliver(redemption_id: string) {
    const r = await fetch("/api/points/rewards", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ redemption_id }),
    });
    if (r.ok) load();
  }

  return (
    <section className="card space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">متجر النقاط 🎁</h2>
        {!isTeacher && <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-bold text-warning">رصيدك: {balance} نقطة</span>}
      </div>
      {msg && <div className="text-xs font-bold text-primary">{msg}</div>}
      <ul className="space-y-2">
        {rewards.map((w) => (
          <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
            <span><b>{w.title}</b> — {w.cost_points} نقطة {w.stock >= 0 && <span className="text-xs text-slate-400">(متبقي {w.stock})</span>}</span>
            {!isTeacher ? (
              <button onClick={() => redeem(w.id)} disabled={balance < w.cost_points}
                className="rounded-lg bg-warning px-3 py-1 text-xs font-bold text-white disabled:opacity-40">استبدال</button>
            ) : (
              <span className={`text-xs font-bold ${w.active ? "text-success" : "text-slate-400"}`}>{w.active ? "نشطة" : "موقوفة"}</span>
            )}
          </li>
        ))}
        {rewards.length === 0 && <li className="text-xs text-slate-400">لا مكافآت بعد.</li>}
      </ul>
      {isTeacher && (
        <>
          <form onSubmit={create} className="grid gap-2 sm:grid-cols-4">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="المكافأة" required maxLength={120}
              className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
            <input value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="التكلفة (نقاط)" required inputMode="numeric" dir="ltr"
              className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
            <input value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="الكمية (فارغ=غير محدود)" inputMode="numeric" dir="ltr"
              className="rounded-xl border border-slate-200 px-3 py-2 text-small" />
            <button className="btn-primary !py-2 text-small">إضافة</button>
          </form>
          {reds.length > 0 && (
            <ul className="space-y-1.5">
              <h3 className="text-small font-bold">طلبات الاستبدال ({reds.filter((r) => r.status === "pending").length} معلقة)</h3>
              {reds.slice(0, 20).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-small">
                  <span><b>{r.student}</b> — {r.title}</span>
                  {r.status === "pending" ? (
                    <button onClick={() => deliver(r.id)} className="rounded-lg bg-success px-3 py-1 text-xs font-bold text-white">تسليم ✅</button>
                  ) : <span className="text-xs font-bold text-success">تم التسليم</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {!isTeacher && mine.length > 0 && (
        <ul className="space-y-1 text-small">
          <h3 className="font-bold">استبدالاتي</h3>
          {mine.slice(0, 10).map((m) => (
            <li key={m.id} className="flex justify-between gap-2">
              <span>{rewards.find((w) => w.id === m.reward_id)?.title ?? ""}</span>
              <span className={`text-xs font-bold ${m.status === "delivered" ? "text-success" : "text-warning"}`}>
                {m.status === "delivered" ? "تم التسليم" : "قيد التسليم"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function StorePage() {
  const [prods, setProds] = useState<Product[] | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState({ title: "", description: "", price: "", subject: "", lesson: "" });
  const [subjFilter, setSubjFilter] = useState("");

  const subjects = (prods ?? []).map((p) => p.subject ?? "").filter((s, i, a) => s && a.indexOf(s) === i);
  const shownProds = subjFilter ? (prods ?? []).filter((p) => p.subject === subjFilter) : prods;
  const [file, setFile] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [notReady, setNotReady] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/store", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setProds(j.products ?? []);
      else if (j?.error === "not_ready") setNotReady(j.message ?? "");
    } catch {}
    try {
      const r = await fetch("/api/store/orders", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setOrders(j.orders ?? []);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const fd = new FormData();
      fd.set("title", form.title);
      fd.set("description", form.description);
      fd.set("price", form.price || "0");
      fd.set("subject", form.subject);
      fd.set("lesson", form.lesson);
      if (file?.[0]) fd.set("file", file[0]);
      const r = await fetch("/api/store", { method: "POST", body: fd });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setMsg("تم نشر المنتج ✅");
        setForm({ title: "", description: "", price: "", subject: "", lesson: "" }); setFile(null);
        load();
      } else setMsg(j?.message ?? "فشل: " + (j?.error ?? ""));
    } catch { setMsg("تعذر الاتصال."); }
    finally { setBusy(false); }
  }

  async function review(id: string, action: "confirm" | "reject") {
    await fetch("/api/store/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: id, action }),
    });
    load();
  }

  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [pos, setPos] = useState<PosLine[]>([{ product_id: "", qty: 1 }]);
  const [posStudent, setPosStudent] = useState("");
  const [posBusy, setPosBusy] = useState(false);
  const [stockEdit, setStockEdit] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/students").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setStudents((j.students ?? []).map((s: any) => ({ id: s.id, name: s.name })));
    }).catch(() => {});
  }, []);

  async function saveStock(id: string) {
    const v = stockEdit[id];
    if (v === undefined) return;
    try {
      const r = await fetch("/api/store/stock", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: id, stock_qty: Number(v) }),
      });
      if (r.ok) { setMsg("تم تحديث المخزون ✅"); load(); }
      else setMsg("فشل التحديث.");
    } catch { setMsg("تعذر الاتصال."); }
  }

  async function sell(e: React.FormEvent) {
    e.preventDefault();
    if (!posStudent) { setMsg("اختر الطالب أولاً."); return; }
    const items = pos.filter((l) => l.product_id && l.qty > 0);
    if (!items.length) { setMsg("أضف صنفاً واحداً على الأقل."); return; }
    setPosBusy(true); setMsg("");
    try {
      const r = await fetch("/api/store/pos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, student_id: posStudent }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setMsg(`تم البيع ✅ ${j.sold} قطعة بإجمالي ${j.total} جنيه${(j.lacking ?? []).length ? ` — تعذر: ${(j.lacking ?? []).join("، ")}` : ""}`);
        setPos([{ product_id: "", qty: 1 }]); setPosStudent(""); load();
      } else setMsg("فشل البيع: " + (j?.error ?? ""));
    } catch { setMsg("تعذر الاتصال."); }
    finally { setPosBusy(false); }
  }

  if (notReady) return <div className="mx-auto max-w-3xl"><div className="card border-warning/30 bg-warning/5 p-6 text-small font-bold text-warning">{notReady}</div></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-h1">المتجر 🛍️</h1>
        <p className="mt-1 text-small text-slate-500">مذكرات وملفات رقمية — الطالب يطلب وأنت تؤكد، والتحميل برابط آمن.</p>
      </header>
      {msg && <p className="card p-3 text-small font-bold text-primary">{msg}</p>}

      <form onSubmit={create} className="card grid gap-3 p-5 sm:grid-cols-2">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
          placeholder="اسم المنتج (مثال: مذكرة فيزياء PDF)" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" />
        <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} inputMode="decimal"
          placeholder="السعر بالجنيه (0 = مجاني)" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none" />
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-2.5 text-small font-bold text-slate-500 hover:border-primary hover:text-primary">
          {file?.length ? `📎 ${file[0].name.slice(0, 30)}` : "ملف المنتج (PDF/صور)"}
          <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files)} />
        </label>
        <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={80}
          placeholder="المادة (مثال: فيزياء)" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
        <input value={form.lesson} onChange={(e) => setForm({ ...form, lesson: e.target.value })} maxLength={120}
          placeholder="الدرس (مثال: الحركة الموجية)" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary" />
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="وصف مختصر (اختياري)" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" />
        <button className="btn-primary sm:col-span-2" disabled={busy}>{busy ? "جاري النشر..." : "نشر المنتج"}</button>
      </form>

      {prods && prods.length > 0 && (
        <section className="card space-y-2 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">منتجاتي ومخزونها ({prods.length})</h2>
            {subjects.length > 0 && (
              <select value={subjFilter} onChange={(e) => setSubjFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs">
                <option value="">كل المواد 📚</option>
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>
          {prods.some((p) => (p.stock_qty ?? -1) >= 0 && (p.stock_qty ?? 0) <= (p.low_stock_at ?? 5)) && (
            <div className="rounded-xl bg-danger/5 p-3 text-xs font-bold text-danger">
              ⚠️ مخزون منخفض: {prods.filter((p) => (p.stock_qty ?? -1) >= 0 && (p.stock_qty ?? 0) <= (p.low_stock_at ?? 5)).map((p) => p.title).join("، ")}
            </div>
          )}
          <ul className="space-y-2">
            {(shownProds ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
                <div>
                  <span className="font-bold">{p.title}</span>
                  {(p.subject || p.lesson) && <span className="mx-2 rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-bold text-primary">{[p.subject, p.lesson].filter(Boolean).join(" · ")}</span>}
                  <span className="mx-2 text-slate-500">{Number(p.price) <= 0 ? "مجاني" : `${p.price} جنيه`}</span>
                  <span className={`text-xs font-bold ${(p.stock_qty ?? -1) < 0 ? "text-slate-400" : (p.stock_qty ?? 0) <= (p.low_stock_at ?? 5) ? "text-danger" : "text-success"}`}>
                    {(p.stock_qty ?? -1) < 0 ? "مخزون ∞" : `مخزون: ${p.stock_qty}`}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <input value={stockEdit[p.id] ?? ""} onChange={(e) => setStockEdit({ ...stockEdit, [p.id]: e.target.value })}
                    placeholder="الكمية (-1=∞)" inputMode="numeric" className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-center text-xs" />
                  <button onClick={() => saveStock(p.id)} className="rounded-lg bg-slate-200 px-3 py-1 text-xs font-bold">حفظ</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">بيع سريع (كاشير) 🧮</h2>
        <select value={posStudent} onChange={(e) => setPosStudent(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-small">
          <option value="">اختر الطالب المشتري…</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {pos.map((l, i) => (
          <div key={i} className="flex gap-2">
            <select value={l.product_id} onChange={(e) => setPos(pos.map((x, j) => (j === i ? { ...x, product_id: e.target.value } : x)))}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-small">
              <option value="">اختر صنفاً…</option>
              {(prods ?? []).map((p) => <option key={p.id} value={p.id}>{p.title} — {p.price} ج</option>)}
            </select>
            <input value={l.qty} onChange={(e) => setPos(pos.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))}
              type="number" min={1} max={99} className="w-20 rounded-xl border border-slate-200 px-2 py-2 text-center text-small" />
            {pos.length > 1 && (
              <button type="button" onClick={() => setPos(pos.filter((_, j) => j !== i))} className="text-danger">✕</button>
            )}
          </div>
        ))}
        <div className="flex gap-2">
          <button type="button" onClick={() => setPos([...pos, { product_id: "", qty: 1 }])} className="btn-secondary !px-3 !py-2 text-xs">+ صنف</button>
          <button onClick={sell} disabled={posBusy} className="btn-primary flex-1 disabled:opacity-50">{posBusy ? "جاري..." : "إتمام البيع ✅"}</button>
        </div>
      </section>

      <PointsSection />
      {orders.length > 0 && (
        <section className="card space-y-2 p-5">
          <h2 className="font-bold">الطلبات ({orders.filter((o) => o.status === "pending").length} بانتظار التأكيد)</h2>
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
                <span><b>{o.student_name}</b> · {o.products?.title} ({o.products?.price} جنيه)</span>
                {o.status === "pending" ? (
                  <span className="flex gap-2">
                    <button onClick={() => review(o.id, "confirm")} className="rounded-lg bg-success px-3 py-1 text-xs font-bold text-white">تأكيد ✅</button>
                    <button onClick={() => review(o.id, "reject")} className="rounded-lg bg-danger/10 px-3 py-1 text-xs font-bold text-danger">رفض</button>
                  </span>
                ) : (
                  <span className={`text-xs font-bold ${o.status === "confirmed" ? "text-success" : "text-danger"}`}>
                    {o.status === "confirmed" ? "مؤكد" : "مرفوض"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
