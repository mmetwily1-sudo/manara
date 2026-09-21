"use client";

import { useEffect, useState } from "react";

type Product = { id: string; title: string; description: string | null; price: number; is_active: boolean };
type Order = { id: string; status: string; created_at: string; student_name: string; products: { title: string; price: number } };

export default function StorePage() {
  const [prods, setProds] = useState<Product[] | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState({ title: "", description: "", price: "" });
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
      if (file?.[0]) fd.set("file", file[0]);
      const r = await fetch("/api/store", { method: "POST", body: fd });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setMsg("تم نشر المنتج ✅");
        setForm({ title: "", description: "", price: "" }); setFile(null);
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
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="وصف مختصر (اختياري)" className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" />
        <button className="btn-primary sm:col-span-2" disabled={busy}>{busy ? "جاري النشر..." : "نشر المنتج"}</button>
      </form>

      {prods && prods.length > 0 && (
        <section className="card space-y-2 p-5">
          <h2 className="font-bold">منتجاتي ({prods.length})</h2>
          <ul className="space-y-2">
            {prods.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-small">
                <span className="font-bold">{p.title}</span>
                <span className="text-slate-500">{Number(p.price) <= 0 ? "مجاني" : `${p.price} جنيه`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
