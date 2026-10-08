"use client";

import { useEffect, useState } from "react";

type Info = { custom_domain: string | null; subdomain: string; cname_target: string };

/** ربط دومين مخصص (ahmedcenter.com) بدل/بجانب subdomain منارة */
export function CustomDomainManager() {
  const [info, setInfo] = useState<Info | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/tenant/domain", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setInfo(j); setValue(j.custom_domain ?? ""); }
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/tenant/domain", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: value.trim() }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setMsg(value.trim() ? "تم ربط الدومين — وجّه CNAME كما بالأسفل ✅" : "تم إلغاء الدومين المخصص"); load(); }
      else setMsg(j?.message ?? "فشل الحفظ.");
    } finally { setBusy(false); }
  }

  if (!info) return null;

  return (
    <div>
      <h2 className="font-bold">دومين مخصص 🌐</h2>
      <p className="mt-1 text-xs text-slate-500">
        منصتك متاحة دائماً على <span dir="ltr" className="font-mono">{info.subdomain}</span>. لو عندك دومين خاص بيك، اربطه هنا.
      </p>
      <form onSubmit={save} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={value} onChange={(e) => setValue(e.target.value)} placeholder="ahmedcenter.com" dir="ltr"
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-small"
        />
        <button type="submit" disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-small font-bold text-white disabled:opacity-50">
          {busy ? "جارٍ الحفظ…" : "حفظ"}
        </button>
      </form>
      {msg && <p className="mt-2 text-xs text-slate-600">{msg}</p>}
      {info.custom_domain && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <p className="font-bold">خطوة أخيرة عند مزوّد الدومين بتاعك:</p>
          <p className="mt-1">أضف سجل CNAME باسم <span dir="ltr" className="font-mono">@</span> أو <span dir="ltr" className="font-mono">www</span> يشير إلى:</p>
          <p className="mt-1 font-mono" dir="ltr">{info.cname_target}</p>
          <p className="mt-2">قد يستغرق الانتشار حتى 24 ساعة. حتى يتم الربط، موقعك يبقى متاحاً على الـsubdomain.</p>
        </div>
      )}
    </div>
  );
}
