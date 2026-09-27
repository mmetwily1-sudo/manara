"use client";

import { useEffect, useState } from "react";
import { AttendanceGrid } from "@/components/AttendanceGrid";
import SessionQr from "@/components/SessionQr";

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
          <AttendanceGrid students={students} sessionId={sessionId} />
        </>
      )}
    </div>
  );
}
