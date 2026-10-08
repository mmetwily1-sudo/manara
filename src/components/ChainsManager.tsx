"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tenant = { id: string; name: string; slug: string; status?: string; plan?: string; owner_user_id?: string | null };
type Chain = { id: string; name: string; owner_user_id: string; created_at: string; tenants: Tenant[] };

export function ChainsManager({ initialChains, unassignedTenants }: { initialChains: Chain[]; unassignedTenants: Tenant[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [seedTenantId, setSeedTenantId] = useState("");
  const [addTenantByChain, setAddTenantByChain] = useState<Record<string, string>>({});
  const [reports, setReports] = useState<Record<string, { students: number; revenue_month: number; active_branches: number } | null>>({});

  async function createChain(e: React.FormEvent) {
    e.preventDefault();
    const seed = unassignedTenants.find((t) => t.id === seedTenantId);
    if (!name.trim() || !seed?.owner_user_id) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/chains", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), ownerUserId: seed.owner_user_id }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        await fetch(`/api/admin/chains/${j.chain.id}/tenants`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId: seed.id }),
        });
        setName(""); setSeedTenantId(""); router.refresh();
      } else alert(j?.error ?? "فشل الإنشاء");
    } catch { alert("تعذر الاتصال"); }
    setBusy(false);
  }

  async function linkTenant(chainId: string) {
    const tenantId = addTenantByChain[chainId];
    if (!tenantId) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/chains/${chainId}/tenants`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (r.ok) { setAddTenantByChain((s) => ({ ...s, [chainId]: "" })); router.refresh(); }
      else alert("فشل الربط");
    } catch { alert("تعذر الاتصال"); }
    setBusy(false);
  }

  async function unlinkTenant(chainId: string, tenantId: string, tenantName: string) {
    if (!confirm(`فصل "${tenantName}" عن السلسلة؟`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/chains/${chainId}/tenants`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (r.ok) router.refresh();
      else alert("فشل الفصل");
    } catch { alert("تعذر الاتصال"); }
    setBusy(false);
  }

  async function loadReport(chainId: string) {
    try {
      const r = await fetch(`/api/chains/${chainId}/report`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setReports((s) => ({ ...s, [chainId]: j.totals }));
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-6">
        <h2 className="font-bold">سلسلة جديدة</h2>
        {unassignedTenants.length === 0 ? (
          <p className="text-small text-slate-400">لا يوجد سنتر بلا سلسلة له مالك مُسجَّل حالياً — لا يمكن بدء سلسلة جديدة.</p>
        ) : (
          <form onSubmit={createChain} className="flex flex-col gap-2 sm:flex-row">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم السلسلة (مثال: مجموعة النور التعليمية)"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-small" />
            <select value={seedTenantId} onChange={(e) => setSeedTenantId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-small">
              <option value="">السنتر الأول (المالك)…</option>
              {unassignedTenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button type="submit" disabled={busy || !name.trim() || !seedTenantId} className="rounded-xl bg-slate-900 px-4 py-2 text-small font-bold text-white disabled:opacity-50">
              إنشاء
            </button>
          </form>
        )}
      </div>

      {initialChains.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">لا توجد سلاسل بعد</div>
      ) : initialChains.map((c) => {
        const linkedIds = new Set(c.tenants.map((t) => t.id));
        const candidates = unassignedTenants.filter((t) => !linkedIds.has(t.id));
        const report = reports[c.id];
        return (
          <div key={c.id} className="card space-y-3 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">{c.name}</h3>
              <button onClick={() => loadReport(c.id)} className="rounded-lg bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200">
                📊 تحديث التقرير
              </button>
            </div>
            {report && (
              <div className="grid grid-cols-3 gap-2 text-center text-small">
                <div className="rounded-xl bg-slate-50 p-2"><div className="font-extrabold">{report.students}</div><div className="text-[11px] text-slate-400">طالب</div></div>
                <div className="rounded-xl bg-slate-50 p-2"><div className="font-extrabold">{report.revenue_month.toLocaleString("ar-EG")}</div><div className="text-[11px] text-slate-400">إيراد الشهر</div></div>
                <div className="rounded-xl bg-slate-50 p-2"><div className="font-extrabold">{report.active_branches}</div><div className="text-[11px] text-slate-400">فرع نشط</div></div>
              </div>
            )}
            <div className="divide-y divide-slate-100">
              {c.tenants.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 text-small">
                  <span>{t.name} <span className="text-xs text-slate-400">({t.status})</span></span>
                  <button onClick={() => unlinkTenant(c.id, t.id, t.name)} disabled={busy} className="rounded-lg bg-danger/10 px-2.5 py-1 text-[11px] font-bold text-danger disabled:opacity-50">
                    فصل
                  </button>
                </div>
              ))}
              {c.tenants.length === 0 && <p className="py-2 text-xs text-slate-400">لا فروع مربوطة</p>}
            </div>
            {candidates.length > 0 && (
              <div className="flex gap-2">
                <select value={addTenantByChain[c.id] ?? ""} onChange={(e) => setAddTenantByChain((s) => ({ ...s, [c.id]: e.target.value }))}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-small">
                  <option value="">أضف فرعاً…</option>
                  {candidates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button onClick={() => linkTenant(c.id)} disabled={busy || !addTenantByChain[c.id]} className="rounded-xl bg-slate-900 px-4 py-2 text-small font-bold text-white disabled:opacity-50">
                  ربط
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
