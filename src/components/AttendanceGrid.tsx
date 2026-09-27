"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type StudentStatus = "present" | "absent" | "pending";
export type Student = { id: string; name: string; groupId: string; parentPhone: string | null; status: StudentStatus };

const STORAGE_KEY = "manara.attendance.queue";
type QueueItem = { sessionId: string; studentId: string; status: Exclude<StudentStatus, "pending"> };

function loadQueue(): QueueItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}
function saveQueue(q: QueueItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(q)); } catch {}
}

/**
 * Tap-Grid التحضير — الهدف: 200 طالب في أقل من 3 دقايق
 * كل تغيير يُرسل فوراً لـ /api/attendance، وعند انقطاع النت يُحفظ في طابور محلي ويُزامَن تلقائياً
 */
export function AttendanceGrid({ students, sessionId }: { students: Student[]; sessionId: string | null }) {
  const [statuses, setStatuses] = useState<Record<string, StudentStatus>>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.status]))
  );
  const [queueLen, setQueueLen] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [codeMode, setCodeMode] = useState(false);
  const [code, setCode] = useState("");
  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;

  // تصفير الحالات عند تبديل المجموعة/الطلاب + مسح طابور الجلسة القديمة
  const studentsKey = students.map((s) => s.id).join(",");
  useEffect(() => {
    setStatuses(Object.fromEntries(students.map((s) => [s.id, s.status])));
    setCode("");
    setCodeMode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsKey]);

  async function flushQueue(items?: QueueItem[]) {
    const sid = sessionRef.current;
    const q = items ?? loadQueue().filter((i) => i.sessionId === sid);
    if (!sid || !q.length || !navigator.onLine) { setQueueLen(loadQueue().length); return; }
    setSyncing(true);
    const remaining: QueueItem[] = [];
    for (const item of q) {
      try {
        const r = await fetch("/api/attendance", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: item.sessionId, studentId: item.studentId, status: item.status }),
        });
        if (!r.ok) remaining.push(item);
      } catch { remaining.push(item); }
    }
    const others = loadQueue().filter((i) => i.sessionId !== sid);
    saveQueue([...others, ...remaining]);
    setQueueLen(loadQueue().length);
    setSyncing(false);
  }

  useEffect(() => {
    flushQueue();
    const update = () => {
      const on = navigator.onLine;
      setOnline(on);
      if (on) flushQueue();
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function record(studentId: string, status: Exclude<StudentStatus, "pending">) {
    const sid = sessionRef.current;
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
    if (!sid) return;
    const q = loadQueue().filter((i) => !(i.sessionId === sid && i.studentId === studentId));
    q.push({ sessionId: sid, studentId, status });
    saveQueue(q);
    setQueueLen(q.length);
    flushQueue(q.filter((i) => i.sessionId === sid));
  }

  function toggle(id: string) {
    setStatuses((prev) => {
      const next = prev[id] === "absent" ? "present" : "absent";
      record(id, next);
      return { ...prev, [id]: next };
    });
  }

  function markAll(status: Exclude<StudentStatus, "pending">) {
    const all: Record<string, StudentStatus> = {};
    students.forEach((s) => { all[s.id] = status; });
    setStatuses(all);
    const sid = sessionRef.current;
    if (!sid) return;
    const others = loadQueue().filter((i) => i.sessionId !== sid);
    const batch: QueueItem[] = students.map((s) => ({ sessionId: sid, studentId: s.id, status }));
    saveQueue([...others, ...batch]);
    setQueueLen(loadQueue().length);
    flushQueue(batch);
  }

  function markAllPresent() {
    markAll("present");
  }

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    const q = code.trim().replace(/\D/g, "");
    if (!q) return;
    const hit = students.find((s) => (s.parentPhone ?? "").replace(/\D/g, "").endsWith(q) || s.name.includes(code.trim()));
    if (hit) {
      record(hit.id, "present");
      setCode("");
    } else {
      alert("لا يوجد طالب بهذا الرقم/الاسم في المجموعة");
    }
  }

  const counts = useMemo(() => {
    let present = 0, absent = 0;
    Object.values(statuses).forEach((s) => {
      if (s === "present") present++;
      else if (s === "absent") absent++;
    });
    return { present, absent };
  }, [statuses]);

  return (
    <div className="space-y-5">
      {!online && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-small font-semibold text-warning">
          شغّال أوفلاين — التحضير بيتسجل عندك وهيتتبعت تلقائياً أول ما النت يرجع
        </div>
      )}
      {!sessionId && (
        <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-small font-semibold text-danger">
          تعذر إنشاء جلسة اليوم — تحقق من الاتصال ثم حدّث الصفحة.
        </div>
      )}

      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex gap-6">
          <div className="text-center">
            <div className="text-h1 font-extrabold text-success">{counts.present}</div>
            <div className="text-xs text-slate-500">حاضر</div>
          </div>
          <div className="text-center">
            <div className="text-h1 font-extrabold text-danger">{counts.absent}</div>
            <div className="text-xs text-slate-500">غايب</div>
          </div>
          <div className="text-center">
            <div className="text-h1 font-extrabold text-slate-300">{students.length - counts.present - counts.absent}</div>
            <div className="text-xs text-slate-500">مستنيين</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary !px-5 !py-2 text-small" onClick={markAllPresent}>
            تحضير الكل ✓
          </button>
          <button className="btn-secondary !px-5 !py-2 text-small" onClick={() => { if (confirm("تسجيل الكل غائب؟")) markAll("absent"); }}>
            تغييب الكل
          </button>
          <button className="btn-secondary !px-5 !py-2 text-small" onClick={() => setCodeMode((v) => !v)}>
            {codeMode ? "إغلاق" : "تحضير بكود"}
          </button>
        </div>
      </div>

      {codeMode && (
        <form onSubmit={submitCode} className="card flex gap-2 p-4">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="اكتب آخر أرقام موبايل الطالب أو اسمه ثم Enter"
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-primary"
            autoFocus
          />
          <button className="btn-primary !px-5 !py-2 text-small">تحضير</button>
        </form>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {students.map((s) => {
          const st = statuses[s.id] ?? "pending";
          const isAbsent = st === "absent";
          const isPending = st === "pending";
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              aria-pressed={isAbsent}
              className={`flex min-h-[64px] items-center justify-between gap-2 rounded-xl border px-4 py-3 text-right transition active:scale-[0.98] ${
                isAbsent
                  ? "border-danger/30 bg-danger/5"
                  : isPending
                    ? "border-slate-200 bg-white hover:border-primary/40"
                    : "border-success/25 bg-success/5"
              }`}
            >
              <span className={`text-small font-bold ${isPending ? "text-slate-400" : ""}`}>{s.name}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isAbsent ? "bg-danger/15 text-danger" : isPending ? "bg-slate-100 text-slate-400" : "bg-success/15 text-success"
                }`}
              >
                {isAbsent ? "غايب" : isPending ? "—" : "حاضر"}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-slate-400">
        اضغط على الطالب = يتحول غايب · يُحفظ في قاعدة البيانات فوراً
        {syncing && " · جاري المزامنة..."}
        {queueLen > 0 && !syncing && ` · ${queueLen} تسجيل مستنيين المزامنة`}
        {queueLen > 0 && !syncing && (
          <button onClick={() => flushQueue()} className="mx-2 font-bold text-primary underline">مزامنة الآن 🔄</button>
        )}
      </p>
    </div>
  );
}
