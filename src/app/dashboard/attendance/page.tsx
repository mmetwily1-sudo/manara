import { AttendanceGrid } from "@/components/AttendanceGrid";
import { getGroups, getStudentsByGroup } from "@/lib/demo-data";

export default function AttendancePage() {
  const groups = getGroups();
  const students = getStudentsByGroup("g1"); // المجموعة المحددة حالياً

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">التحضير</h1>
          <p className="mt-1 text-small text-slate-500">مجموعة السبت · ٣ ثانوي · فيزياء · 4:00 م</p>
        </div>
        <div className="flex gap-2">
          {groups.map((g) => (
            <span
              key={g.id}
              className={`rounded-full px-4 py-1.5 text-xs font-bold ${
                g.id === "g1" ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {g.name}
            </span>
          ))}
        </div>
      </header>

      <AttendanceGrid students={students} />
    </div>
  );
}
