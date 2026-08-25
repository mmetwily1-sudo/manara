import { getStudentsByGroup } from "@/lib/demo-data";

export default function StudentsPage() {
  const students = getStudentsByGroup();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">الطلاب</h1>
          <p className="mt-1 text-small text-slate-500">{students.length} طالب في 3 مجموعات</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-small">استيراد Excel</button>
          <button className="btn-primary text-small">طالب جديد</button>
        </div>
      </header>

      <section className="card overflow-hidden">
        <table className="w-full text-right text-small">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>{["الطالب", "المجموعة", "ولي الأمر", "حضور الشهر", "الحالة"].map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((s, i) => {
              const attendance = [92, 40, 88, 95, 90, 85, 70, 55, 45, 80][i % 10];
              return (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-bold">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.groupId === "g1" ? "السبت" : s.groupId === "g2" ? "الأحد" : "الثلاثاء"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400" dir="ltr">{s.parentPhone}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${attendance >= 85 ? "text-success" : attendance >= 70 ? "text-warning" : "text-danger"}`}>
                      {attendance}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${attendance >= 70 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                      {attendance >= 70 ? "منتظم" : "إنذار مبكر"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
