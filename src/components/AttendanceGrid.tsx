"use client";

import { useEffect, useMemo, useState } from "react";
import type { Student, StudentStatus } from "@/lib/demo-data";

/**
 * Tap-Grid التحضير — الهدف: 200 طالب في أقل من 3 دقايق
 * نمط حاضر: "تحضير الكل" ثم ضغط الغايبين بس
 * Offline-first: كل تغيير يتسجل في localStorage ويتزامن لما النت يرجع (stub)
 */

const STORAGE_KEY = "manara.attendance.queue";

type QueueItem = { studentId: string; status: StudentStatus; at: number };

function loadQueue(): QueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function AttendanceGrid({ students }: { students: Student[] }) {
  const [statuses, setStatuses] = useState<Record<string, StudentStatus>>(
    Object.fromEntries(students.map((s) => [s.id, s.status]))
  );
  const [queueLen, setQueueLen] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setQueueLen(loadQueue().length);
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  function enqueue(studentId: string, status: StudentStatus) {
    // TODO(Phase 1.2): POST /api/attendance — لو فشل الشبكة يفضل في الـqueue
    const q = loadQueue().filter((i) => i.studentId !== studentId);
    q.push({ studentId, status, at: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
    setQueueLen(q.length);
  }

  function toggle(id: string) {
    setStatuses((prev) => {
      const next: StudentStatus = prev[id] === "absent" ? "present" : "absent";
      enqueue(id, next);
      return { ...prev, [id]: next };
    });
  }

  function markAllPresent() {
    const all: Record<string, StudentStatus> = {};
    students.forEach((s) => {
      all[s.id] = "present";
      enqueue(s.id, "present");
    });
    setStatuses(all);
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
      {/* حالة الأوفلاين — واضحة دايماً */}
      {!online && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-small font-semibold text-warning">
          شغّال أوفلاين — التحضير بيتسجل عندك وهيتتبعت تلقائياً أول ما النت يرجع
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
          <button className="btn-secondary !px-5 !py-2 text-small">مسح QR</button>
        </div>
      </div>

      {/* الشبكة — touch targets سخية، الغايب بيتباكن فوراً */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {students.map((s) => {
          const st = statuses[s.id];
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
        اضغط على الطالب = يتحول غايب · الإشعار لولي الأمر بيبعت لوحده لحظة التسجيل
        {queueLen > 0 && ` · ${queueLen} تسجيل مستنيين المزامنة`}
      </p>
    </div>
  );
}
