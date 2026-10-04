"use client";

import { useEffect, useState } from "react";
import { waTo } from "@/lib/wa";
import { SkeletonTable, SkeletonList, EmptyState } from "@/components/Loading";

type Student = { id: string; name: string; phone: string | null; groups: { id: string; name: string }[] };
type Group = { id: string; name: string };

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [filterGroup, setFilterGroup] = useState("");
  const [err, setErr] = useState("");
  const [parentLink, setParentLink] = useState<{ name: string; url: string } | null>(null);
  const [copiedParent, setCopiedParent] = useState(false);
  const [linkBusy, setLinkBusy] = useState<string | null>(null);
  const [newPin, setNewPin] = useState<{ name: string; pin: string } | null>(null);
  const [pinBusy, setPinBusy] = useState<string | null>(null);

  /** تجديد PIN طالب (يُعرض مرة واحدة — للطالب/ولي الأمر) */
  async function regenPin(id: string, name: string) {
    setPinBusy(id); setErr("");
    try {
      const r = await fetch("/api/students/pin-set", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: id }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok && j.pin) setNewPin({ name, pin: j.pin });
      else setErr("تعذر توليد PIN — حاول تاني");
    } catch { setErr("تعذر الاتصال"); }
    setPinBusy(null);
  }

  /** توليد رابط ولي الأمر لطالب موجود (استرداد عند ضياع الرابط) */
  async function genParentLink(id: string, name: string) {
    setLinkBusy(id); setErr("");
    try {
      const r = await fetch("/api/parent/portal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: id }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok && j.token) {
        setParentLink({ name, url: `${window.location.origin}/parent/enter?token=${j.token}` });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else setErr("تعذر توليد الرابط — حاول تاني");
    } catch { setErr("تعذر الاتصال"); }
    setLinkBusy(null);
  }
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; bad: string[] } | null>(null);
  const [transferFor, setTransferFor] = useState<string | null>(null);
  const [transferTo, setTransferTo] = useState("");
  type Complaint = { id: string; student: string; kind: string; body: string; status: string; reply: string; category: string; priority: string };
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [copen, setCopen] = useState(0);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [cfilter, setCfilter] = useState({ category: "", priority: "" });
  type Alum = { id: string; name: string; grad_year: number; achievement: string; featured: boolean };
  const [alums, setAlums] = useState<Alum[] | null>(null);
  const [aform, setAform] = useState({ name: "", grad_year: String(new Date().getFullYear()), achievement: "", phone: "" });

  async function loadComplaints() {
    try {
      const params = new URLSearchParams();
      if (cfilter.category) params.set("category", cfilter.category);
      if (cfilter.priority) params.set("priority", cfilter.priority);
      const r = await fetch(`/api/complaints?${params.toString()}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok && j.isTeacher) { setComplaints(j.rows ?? []); setCopen(j.open ?? 0); }
    } catch {}
  }
  useEffect(() => { loadComplaints(); }, []);

  async function suggestReply(id: string) {
    try {
      const r = await fetch(`/api/complaints/suggest?id=${id}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setReplies({ ...replies, [id]: j.suggestion });
    } catch {}
  }

  async function resolveComplaint(id: string) {
    const reply = (replies[id] ?? "").trim();
    if (reply.length < 2) return;
    const r = await fetch("/api/complaints", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, reply }),
    });
    if (r.ok) { setReplies({ ...replies, [id]: "" }); loadComplaints(); }
  }

  async function loadAlums() {
    try {
      const r = await fetch("/api/alumni", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setAlums(j.rows ?? []);
    } catch {}
  }
  useEffect(() => { loadAlums(); }, []);

  async function saveAlum(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/alumni", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(aform),
    });
    if (r.ok) { setAform({ name: "", grad_year: String(new Date().getFullYear()), achievement: "", phone: "" }); loadAlums(); }
  }

  async function featureAlum(id: string, featured: boolean) {
    const r = await fetch("/api/alumni", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, featured }),
    });
    if (r.ok) loadAlums();
  }

  async function onTransfer(id: string) {
    if (!transferTo) return;
    try {
      const r = await fetch("/api/students/transfer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: id, to_group_id: transferTo }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setTransferFor(null); setTransferTo(""); load(); }
      else setErr(j?.error === "group_full" ? "المجموعة المستهدفة مكتملة — اختر مجموعة أخرى أو قائمة الانتظار." : "فشل النقل.");
    } catch { setErr("تعذر الاتصال."); }
  }
  const [form, setForm] = useState({ name: "", phone: "", groupId: "" });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const [rs, rg] = await Promise.all([fetch("/api/students"), fetch("/api/groups")]);
      const js = await rs.json().catch(() => null);
      const jg = await rg.json().catch(() => null);
      if (!rs.ok || !js?.ok) { setErr("تعذر تحميل الطلاب."); return; }
      setStudents(js.students);
      if (rg.ok && jg?.ok) setGroups(jg.groups.map((g: any) => ({ id: g.id, name: g.name })));
      setErr("");
    } catch { setErr("تعذر الاتصال بالخادم."); }
  }
  useEffect(() => { load(); }, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setParentLink(null);
    try {
      const r = await fetch("/api/students", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        const addedName = form.name;
        setForm({ name: "", phone: "", groupId: "" });
        setShowAdd(false);
        if (j.parent_url) setParentLink({ name: addedName, url: j.parent_url });
        if (j.student_pin) setNewPin({ name: addedName, pin: j.student_pin });
        load();
      } else {
        setErr(j?.error === "phone_exists" ? "هذا الرقم مسجل لطالب آخر في سنترك." : "فشل الإضافة: " + (j?.error ?? "خطأ غير معروف"));
      }
    } catch { setErr("تعذر الاتصال بالخادم."); }
    finally { setBusy(false); }
  }

  function copyInvite() {
    const url = `${window.location.origin}/join`;
    navigator.clipboard?.writeText(`سجّل في سنترنا من هنا: ${url}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  const visible = filterGroup
    ? (students ?? []).filter((s) => s.groups.some((g) => g.id === filterGroup))
    : students ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">الطلاب</h1>
          <p className="mt-1 text-small text-slate-500">
            {students === null ? "…" : `${students.length} طالب`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={copyInvite} className="btn-secondary text-small">
            {copied ? "✓ تم النسخ" : "نسخ رابط التسجيل"}
          </button>
          <a href="/api/export?scope=students" className="btn-secondary text-small">تصدير CSV ⬇️</a>
          <button onClick={() => setShowAdd((v) => !v)} className="btn-primary text-small">طالب جديد</button>
          <button onClick={() => { setShowImport((v) => !v); setShowAdd(false); }} className="btn-secondary text-small">استيراد 📥</button>
        </div>
      </header>

      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}

      {parentLink && (
        <div className="card space-y-2 border-success/30 bg-success/5 p-5">
          <p className="text-small font-bold text-success">✅ تمت إضافة {parentLink.name} — رابط ولي الأمر جاهز</p>          <p className="text-xs text-slate-600">ابعت الرابط لولي الأمر (واتساب/ورقة) — يدخل مباشرة بلا حساب ولا باسورد.</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { navigator.clipboard?.writeText(parentLink.url).then(() => { setCopiedParent(true); setTimeout(() => setCopiedParent(false), 2000); }).catch(() => {}); }}
              className="btn-secondary !px-4 !py-2 text-small"
            >
              {copiedParent ? "✓ تم النسخ" : "نسخ رابط الولي"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`رابط متابعة ${parentLink.name} الدراسية (حضور ودرجات ومصروفات): ${parentLink.url}`)}`}
              target="_blank" rel="noopener noreferrer"
              className="btn-primary !px-4 !py-2 text-small"
            >
              مشاركة واتساب 📤
            </a>
            <button onClick={() => setParentLink(null)} className="btn-secondary !px-4 !py-2 text-small">إغلاق</button>
          </div>
        </div>
      )}

      {newPin && (
        <div className="card space-y-2 border-primary/30 bg-primary-light/40 p-5">
          <p className="text-small font-bold text-primary">🔑 PIN دخول {newPin.name} (يُعرض مرة واحدة — سلّمه للطالب)</p>
          <p className="text-center font-mono text-3xl font-extrabold tracking-[0.4em]" dir="ltr">{newPin.pin}</p>
          <p className="text-center text-xs text-slate-500">يدخل برقم موبايله + هذا الـ PIN من صفحة السنتر — للأونلاين والتقدم.</p>
          <div className="flex justify-center">
            <button onClick={() => setNewPin(null)} className="btn-secondary !px-4 !py-2 text-small">تم — إخفاء</button>
          </div>
        </div>
      )}

      {showAdd && (
        <form onSubmit={onAdd} className="card grid gap-3 p-5 sm:grid-cols-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الطالب الكامل" required minLength={2} className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary sm:col-span-2" />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="رقم موبايل الطالب / ولي الأمر" dir="ltr" className="rounded-xl border border-slate-200 px-4 py-2.5 text-right outline-none focus:border-primary" />
          <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5">
            <option value="">بدون مجموعة (لاحقاً)</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button className="btn-primary sm:col-span-2" disabled={busy}>{busy ? "جاري الحفظ..." : "حفظ الطالب"}</button>
          <p className="text-xs text-slate-400 sm:col-span-2">سيتمكن الطالب من تفعيل حساب دخوله بنفس الرقم من صفحة التسجيل.</p>
        </form>
      )}

      {showImport && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true); setErr(""); setImportResult(null);
            try {
              const rows = importText.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
                const [name, phone] = l.split(/[,،\t]/).map((s) => s.trim());
                return { name, phone, group_id: filterGroup || undefined };
              }).filter((r) => r.name);
              const r = await fetch("/api/students/import", {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }),
              });
              const j = await r.json().catch(() => null);
              if (r.ok && j?.ok) { setImportResult(j); setImportText(""); load(); }
              else setErr("فشل الاستيراد.");
            } catch { setErr("تعذر الاتصال."); }
            finally { setBusy(false); }
          }}
          className="card space-y-3 p-5"
        >
          <h3 className="font-bold">استيراد طلاب 📥 <span className="text-xs font-normal text-slate-400">سطر لكل طالب: الاسم، الهاتف — انسخ عمودين مباشرة من شيت جوجل والصقهما هنا</span></h3>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={6} dir="auto"
            placeholder={"أحمد محمد، 01001234567\nمنى علي، 01007654321"} className="input w-full font-mono" />
          {importResult && (
            <div className="rounded-xl bg-success/5 p-3 text-small font-bold text-success">
              تم استيراد {importResult.imported} ✅ · متخطى (مكرر) {importResult.skipped}
              {importResult.bad.length > 0 && <span className="text-warning"> · فشل: {importResult.bad.join("، ")}</span>}
            </div>
          )}
          <button className="btn-primary" disabled={busy}>{busy ? "جاري..." : "استيراد"}</button>
        </form>
      )}

      {groups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterGroup("")} className={`rounded-full px-4 py-1.5 text-xs font-bold ${!filterGroup ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}>الكل</button>
          {groups.map((g) => (
            <button key={g.id} onClick={() => setFilterGroup(filterGroup === g.id ? "" : g.id)} className={`rounded-full px-4 py-1.5 text-xs font-bold ${filterGroup === g.id ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}>{g.name}</button>
          ))}
        </div>
      )}

      <section className="card overflow-hidden">
        {students === null ? (
          <SkeletonTable cols={4} rows={5} />
        ) : visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon="🎓"
              title="لا يوجد طلاب بعد"
              desc="أضف أول طالب بالزر بالأعلى، أو انسخ رابط التسجيل وأرسله لطلابك على واتساب."
              actionLabel="➕ أضف طالب"
              onAction={() => setShowAdd(true)}
            />
          </div>
        ) : (
          <>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-right text-small">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>{["الطالب", "المجموعات", "الهاتف", "تقرير", "تذكير"].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-bold">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {s.groups.length ? s.groups.map((g) => g.name).join("، ") : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400" dir="ltr">{s.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <a href={`/reports/parent/${s.id}`} className="text-xs font-bold text-primary hover:underline">تقرير 📄</a>
                      <a href={`/card/${s.id}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-slate-500 hover:underline">بطاقة 🪪</a>
                      {transferFor === s.id ? (
                        <>
                          <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]">
                            <option value="">إلى مجموعة…</option>
                            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                          <button onClick={() => onTransfer(s.id)} disabled={!transferTo} className="rounded-lg bg-primary-light px-2 py-1 text-[11px] font-bold text-primary disabled:opacity-50">نقل</button>
                          <button onClick={() => { setTransferFor(null); setTransferTo(""); }} className="text-[11px] text-slate-400">✕</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setTransferFor(s.id); setTransferTo(""); }} className="text-xs font-bold text-slate-500 hover:underline">نقل 🔀</button>{" "}
                          <button onClick={() => genParentLink(s.id, s.name)} disabled={linkBusy === s.id} className="text-xs font-bold text-slate-500 hover:underline disabled:opacity-50">
                            {linkBusy === s.id ? "..." : "رابط الولي 🔗"}
                          </button>{" "}
                          <button onClick={() => regenPin(s.id, s.name)} disabled={pinBusy === s.id} className="text-xs font-bold text-slate-500 hover:underline disabled:opacity-50">
                            {pinBusy === s.id ? "..." : "PIN جديد 🔑"}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const link = waTo(s.phone, `السلام عليكم 👋 تذكير من سنترنا: برجاء متابعة المصروفات الشهرية الخاصة بالطالب ${s.name} — للاستفسار تواصل معنا.`);
                      return link
                        ? <a href={link} target="_blank" rel="noreferrer" className="text-xs font-bold text-success hover:underline">واتساب 💬</a>
                        : <span className="text-xs text-slate-300">—</span>;
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <ul className="space-y-2 p-3 md:hidden">
            {visible.map((s) => (
              <li key={s.id} className="rounded-2xl border border-slate-200/70 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{s.name}</span>
                  <a href={`/card/${s.id}`} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">بطاقة 🪪</a>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {s.groups.length ? s.groups.map((g) => g.name).join("، ") : "—"} · <span dir="ltr">{s.phone ?? ""}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a href={`/reports/parent/${s.id}`} className="rounded-xl bg-primary-light px-3 py-2 text-center text-xs font-bold text-primary">تقرير 📄</a>
                  <a href={`/card/${s.id}`} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-100 px-3 py-2 text-center text-xs font-bold text-slate-600">طباعة البطاقة 🖨️</a>
                  {transferFor === s.id ? (
                    <>
                      <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-small">
                        <option value="">إلى مجموعة…</option>
                        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                      <button onClick={() => onTransfer(s.id)} disabled={!transferTo} className="btn-primary !py-2 text-small disabled:opacity-50">نقل ✅</button>
                    </>
                  ) : (
                    <button onClick={() => { setTransferFor(s.id); setTransferTo(""); }} className="btn-secondary !py-2 text-small">نقل 🔀</button>
                  )}
                  {(() => {
                    const link = waTo(s.phone, `السلام عليكم 👋 تذكير من سنترنا: برجاء متابعة المصروفات الشهرية الخاصة بالطالب ${s.name} — للاستفسار تواصل معنا.`);
                    return link
                      ? <a href={link} target="_blank" rel="noreferrer" className="btn-secondary !border-success/30 !py-2 text-small !text-success">واتساب 💬</a>
                      : <span />;
                  })()}
                </div>
              </li>
            ))}
          </ul>
          </>
        )}
      </section>
      <section className="card space-y-3 p-5">
        <h2 className="font-bold">شكاوى ومقترحات 📮 {copen > 0 && <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] text-white">{copen} مفتوحة</span>}</h2>
        <div className="flex gap-2">
          <select value={cfilter.category} onChange={(e) => setCfilter({ ...cfilter, category: e.target.value })}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs">
            <option value="">كل الفئات</option>
            <option value="billing">مصاريف</option>
            <option value="attendance">حضور</option>
            <option value="exams">امتحانات</option>
            <option value="teaching">تدريس</option>
            <option value="suggestion">اقتراح</option>
            <option value="general">عام</option>
          </select>
          <select value={cfilter.priority} onChange={(e) => setCfilter({ ...cfilter, priority: e.target.value })}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs">
            <option value="">كل الأولويات</option>
            <option value="high">🔥 عاجلة</option>
            <option value="normal">عادية</option>
          </select>
          <button onClick={loadComplaints} className="btn-secondary !px-3 !py-1.5 text-xs">تصفية</button>
        </div>
        {complaints === null ? <SkeletonList rows={2} /> :
          complaints.length === 0 ? <div className="text-xs text-slate-400">لا رسائل.</div> :
          <ul className="space-y-2">
            {complaints.slice(0, 20).map((c) => (
              <li key={c.id} className="rounded-xl bg-slate-50 px-4 py-2.5 text-small">
                <div className="flex justify-between gap-2">
                  <span className="font-bold">{c.student || "—"} {c.kind === "suggestion" ? "💡" : "😟"}</span>
                  <span className="flex items-center gap-1">
                    {c.priority === "high" && <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">🔥 عاجلة</span>}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      {{ billing: "مصاريف", attendance: "حضور", exams: "امتحانات", teaching: "تدريس", suggestion: "اقتراح", general: "عام" }[c.category as string] ?? c.category}
                    </span>
                  </span>
                  <span className={`text-xs font-bold ${c.status === "resolved" ? "text-success" : "text-warning"}`}>
                    {c.status === "resolved" ? "تم الرد" : "مفتوحة"}
                  </span>
                </div>
                <div dir="auto" className="mt-1">{c.body}</div>
                {c.status === "open" ? (
                  <div className="mt-2 flex gap-2">
                    <input value={replies[c.id] ?? ""} onChange={(e) => setReplies({ ...replies, [c.id]: e.target.value })}
                      placeholder="اكتب الرد..." maxLength={1000}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-small" />
                    <button onClick={() => suggestReply(c.id)} title="اقتراح رد تلقائي" className="rounded-lg bg-primary-light px-3 py-1.5 text-xs font-bold text-primary">✨</button>
                    <button onClick={() => resolveComplaint(c.id)} className="rounded-lg bg-success px-3 py-1.5 text-xs font-bold text-white">رد وإغلاق</button>
                  </div>
                ) : c.reply ? <div dir="auto" className="mt-1 text-xs text-slate-500">ردك: {c.reply}</div> : null}
              </li>
            ))}
          </ul>}
      </section>
      <section className="card space-y-3 p-5">
        <h2 className="font-bold">الخريجون 🎓</h2>
        <form onSubmit={saveAlum} className="grid gap-2 sm:grid-cols-4">
          <input value={aform.name} onChange={(e) => setAform({ ...aform, name: e.target.value })} placeholder="الاسم" required maxLength={80}
            className="rounded-xl border border-slate-200 px-4 py-2 text-small" />
          <input value={aform.grad_year} onChange={(e) => setAform({ ...aform, grad_year: e.target.value })} placeholder="سنة التخرج" required inputMode="numeric" dir="ltr"
            className="rounded-xl border border-slate-200 px-4 py-2 text-small" />
          <input value={aform.achievement} onChange={(e) => setAform({ ...aform, achievement: e.target.value })} placeholder="الإنجاز (كلية/مجموع...)" maxLength={500}
            className="rounded-xl border border-slate-200 px-4 py-2 text-small sm:col-span-2" />
          <button className="btn-primary !py-2 text-small sm:col-span-4">تسجيل خريج</button>
        </form>
        {alums === null ? <SkeletonList rows={2} /> :
          alums.length === 0 ? <div className="text-xs text-slate-400">لا خريجين مسجلين.</div> :
          <ul className="divide-y divide-slate-100 text-small">
            {alums.slice(0, 30).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 py-1.5">
                <span><b>{a.name}</b> <span className="text-xs text-slate-400">دفعة {a.grad_year}</span>
                  {a.achievement && <span className="block text-xs text-slate-500" dir="auto">{a.achievement}</span>}</span>
                <button onClick={() => featureAlum(a.id, !a.featured)}
                  className={`text-xs font-bold ${a.featured ? "text-warning" : "text-slate-400"}`}>
                  {a.featured ? "⭐ مميز" : "تمييز"}
                </button>
              </li>
            ))}
          </ul>}
      </section>
    </div>
  );
}
