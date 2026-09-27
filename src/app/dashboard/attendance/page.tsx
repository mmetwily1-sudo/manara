"use client";

import { useEffect, useState } from "react";
import { AttendanceGrid } from "@/components/AttendanceGrid";
import SessionQr from "@/components/SessionQr";

/** تعيين بديل للحصة (مالك + مشرف) */
function SwapBlock({ sessionId }: { sessionId: string | null }) {
  const [staff, setStaff] = useState<{ id: string; full_name: string }[]>([]);
  const [sub, setSub] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/staff/names").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setStaff(j.staff);
    }).catch(() => {});
  }, []);

  async function swap() {
    if (!sessionId || !sub) return;
    try {
      const r = await fetch("/api/sessions/swap", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, substitute_id: sub }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setMsg(`البديل: ${j.substitute} ✅`);
      else setMsg("تعذر التعيين.");
    } catch { setMsg("تعذر الاتصال."); }
  }

  if (!staff.length) return null;
  return (
    <section className="card flex flex-wrap items-center gap-2 p-4">
      <span className="text-small font-bold">تبديل الحصة 🔀</span>
      <select value={sub} onChange={(e) => setSub(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-small">
        <option value="">البديل…</option>
        {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
      </select>
      <button onClick={swap} disabled={!sub} className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-50">تعيين</button>
      {msg && <span className="text-xs font-bold text-primary">{msg}</span>}
    </section>
  );
}

/** أعذار الغياب: تسجيل + اعتماد (المعذور يُستثنى من التصعيد) */
function ExcusesBlock({ students }: { students: { id: string; name: string }[] }) {
  const [list, setList] = useState<{ id: string; student_id: string; reason: string; status: string; users: { full_name: string } | null }[]>([]);
  const [sid, setSid] = useState("");
  const [reason, setReason] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/excuses");
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setList(j.excuses);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!sid) return;
    try {
      const r = await fetch("/api/excuses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: sid, reason }),
      });
      if (r.ok) { setSid(""); setReason(""); load(); }
    } catch {}
  }

  async function decide(id: string, status: string) {
    try {
      const r = await fetch("/api/excuses", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }),
      });
      if (r.ok) load();
    } catch {}
  }

  const pending = list.filter((x) => x.status === "pending");
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-bold">أعذار الغياب 📝 <span className="text-xs font-normal text-slate-400">({pending.length} بانتظار — المعتمد يُستثنى من تصعيد الغياب)</span></h2>
      <form onSubmit={create} className="flex flex-wrap gap-2">
        <select value={sid} onChange={(e) => setSid(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-small">
          <option value="">الطالب…</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="سبب العذر (اختياري)"
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-small" />
        <button className="btn-secondary !px-4 !py-2 text-xs">تسجيل عذر</button>
      </form>
      {pending.slice(0, 10).map((x) => (
        <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-small">
          <span><b>{x.users?.full_name ?? ""}</b> <span className="text-xs text-slate-400">· {x.reason || "بلا سبب"}</span></span>
          <div className="flex gap-2">
            <button onClick={() => decide(x.id, "approved")} className="rounded-lg bg-success/10 px-3 py-1 text-xs font-bold text-success">اعتماد ✓</button>
            <button onClick={() => decide(x.id, "rejected")} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">رفض</button>
          </div>
        </div>
      ))}
    </section>
  );
}

/** نسب الحضور الشهرية — تنبيه تحت 75% */
function MonthlyRates() {
  const [rates, setRates] = useState<Record<string, { present: number; absent: number; rate: number | null }>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      try {
        const [rm, rs] = await Promise.all([fetch("/api/attendance/monthly"), fetch("/api/students")]);
        const jm = await rm.json().catch(() => null);
        const js = await rs.json().catch(() => null);
        if (rm.ok && jm?.ok) setRates(jm.rates);
        if (rs.ok && js?.ok) {
          const m: Record<string, string> = {};
          (js.students ?? []).forEach((s: any) => { m[s.id] = s.name; });
          setNames(m);
        }
      } catch {}
    })();
  }, []);
  const low = Object.entries(rates).filter(([, v]) => v.rate !== null && (v.rate as number) < 75);
  if (!low.length) return null;
  return (
    <section className="card space-y-2 border-warning/25 p-5">
      <h2 className="font-bold text-warning">حضور شهري تحت 75% ({low.length}) ⚠️</h2>
      {low.slice(0, 15).map(([sid, v]) => (
        <div key={sid} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2 text-small">
          <span className="font-bold">{names[sid] ?? "—"}</span>
          <span className="font-extrabold text-warning">{v.rate}% <span className="font-normal text-slate-400">({v.present} حضور / {v.absent} غياب)</span></span>
        </div>
      ))}
    </section>
  );
}

type Group = { id: string; name: string; grade: string | null; subject: string | null };
type Student = { id: string; name: string; groupId: string; parentPhone: string | null; status: "present" | "absent" | "pending" };

export default function AttendancePage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/groups")
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (r.ok && j?.ok && (j.groups ?? []).length) {
          setGroups(j.groups);
          setGroupId(j.groups[0].id);
        } else {
          setErr(j?.error === "unauth" ? "سجّل دخولك أولاً." : "لا توجد مجموعات — أنشئ مجموعة أولاً من صفحة المجموعات.");
          setLoading(false);
        }
      })
      .catch(() => { setErr("تعذر الاتصال بالخادم."); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!groupId) return;
    setLoading(true); setErr("");
    Promise.all([
      fetch(`/api/students?groupId=${groupId}`).then((r) => r.json().catch(() => null)),
      fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId }) }).then((r) => r.json().catch(() => null)),
    ]).then(([sj, sessj]) => {
      if (sj?.ok) {
        setStudents((sj.students ?? []).map((s: any) => ({
          id: s.id, name: s.name, groupId, parentPhone: s.phone ?? null, status: "pending" as const,
        })));
      } else setErr("تعذر تحميل الطلاب.");
      if (sessj?.ok && sessj.session?.id) setSessionId(sessj.session.id);
      else setErr((prev) => prev || "تعذر إنشاء جلسة اليوم.");
      setLoading(false);
    }).catch(() => { setErr("تعذر الاتصال بالخادم."); setLoading(false); });
  }, [groupId]);

  const activeGroup = groups.find((g) => g.id === groupId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">التحضير</h1>
          <p className="mt-1 text-small text-slate-500">
            {activeGroup ? `${activeGroup.name}${activeGroup.grade ? ` · ${activeGroup.grade}` : ""}${activeGroup.subject ? ` · ${activeGroup.subject}` : ""}` : "اختر المجموعة"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setGroupId(g.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold ${g.id === groupId ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </header>

      {err && <div className="card border-danger/20 bg-danger/5 p-4 text-small font-bold text-danger">{err}</div>}

      {loading ? (
        <div className="card p-8 text-center text-slate-400">جاري تجهيز الجلسة...</div>
      ) : students.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-small text-slate-500">لا يوجد طلاب في هذه المجموعة</p>
          <p className="mt-1 text-xs text-slate-400">أضف طلاباً من صفحة الطلاب أولاً.</p>
        </div>
      ) : (
        <>
          <SessionQr sessionId={sessionId} />
          <SwapBlock sessionId={sessionId} />
          <AttendanceGrid students={students} sessionId={sessionId} />
          <ExcusesBlock students={students} />
          <MonthlyRates />
        </>
      )}
    </div>
  );
}
