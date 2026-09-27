"use client";

import { useEffect, useState } from "react";

type Tpl = { key: string; channel: string; title: string; body: string; is_active: boolean; custom: boolean };

async function apiFetch(path: string, init?: RequestInit) {
  const r = await fetch(path, init);
  const j = await r.json().catch(() => null);
  return { r, j };
}

/** قوالب رسائل السنتر: الافتراضية + تجاوز مالك + نسخ */
export default function TemplatesPage() {
  const [tpls, setTpls] = useState<Tpl[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    const { r, j } = await apiFetch("/api/templates");
    if (r.ok && j?.ok) setTpls(j.templates);
    else setNotice({ kind: "err", text: "تعذر تحميل القوالب." });
  }
  useEffect(() => { load(); }, []);

  async function save(t: Tpl) {
    const { r, j } = await apiFetch("/api/templates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: t.key, title: t.title, body: draft, channel: t.channel }),
    });
    if (r.ok && j?.ok) { setNotice({ kind: "ok", text: "تم حفظ القالب." }); setEditing(null); load(); }
    else setNotice({ kind: "err", text: "فشل الحفظ." });
  }

  function copy(key: string, body: string) {
    navigator.clipboard?.writeText(body).then(() => {
      setCopied(key); setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-h1">قوالب الرسائل 💬</h1>
        <p className="mt-1 text-small text-slate-500">صِغ رسائلك مرة واحدة — واستخدم المتغيرات {"{student} {amount} {date} {center}"} وانسخها لواتساب</p>
      </header>
      {notice && <div className={`card p-4 text-small font-bold ${notice.kind === "ok" ? "text-success" : "text-danger"}`}>{notice.text}</div>}
      {!tpls ? (
        <div className="card p-8 text-center text-slate-400">جاري التحميل...</div>
      ) : (
        <ul className="space-y-3">
          {tpls.map((t) => (
            <li key={t.key} className="card space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold">{t.title} {t.custom && <span className="text-xs font-normal text-primary">(مخصص ✏️)</span>}</div>
                <div className="flex gap-2">
                  <button onClick={() => copy(t.key, t.body)} className="btn-secondary !px-3 !py-1.5 text-xs">{copied === t.key ? "✓ تم النسخ" : "نسخ 📋"}</button>
                  <button
                    onClick={() => { setEditing(editing === t.key ? null : t.key); setDraft(t.body); }}
                    className="rounded-lg bg-primary-light px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary hover:text-white"
                  >
                    {editing === t.key ? "إلغاء" : "تخصيص"}
                  </button>
                </div>
              </div>
              {editing === t.key ? (
                <div className="space-y-2">
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} maxLength={1000} className="input w-full" dir="auto" />
                  <button onClick={() => save(t)} className="btn-primary !px-4 !py-2 text-xs">حفظ القالب</button>
                </div>
              ) : (
                <p className="rounded-xl bg-slate-50 p-3 text-small text-slate-600" dir="auto">{t.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
