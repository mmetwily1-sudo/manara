"use client";

import { getDemoHlsUrl } from "@/lib/bunny";

export default function ExamsListPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1">الامتحانات</h1>
          <p className="mt-1 text-small text-slate-500">امتحانات بضغطة: اختر التوزيع واترك التوليد علينا — مع باسورد لكل طالب</p>
        </div>
      </header>

      <div className="card p-6">
        <h2 className="font-bold">توليد امتحان جديد</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={async (e: any) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const body = { title: fd.get("title"), distribution: { 1: Number(fd.get("easy") ?? 2), 2: Number(fd.get("mid") ?? 2), 3: Number(fd.get("hard") ?? 1) } };
          const r = await fetch("/api/exams/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
          const j = await r.json();
          alert(j.ok ? `اتولد: ${j.examId}` : j.error);
        }}>
          <input name="title" placeholder="عنوان الامتحان" required className="rounded-xl border border-slate-200 px-4 py-2.5 outline-none" />
          <div className="flex gap-2 text-xs">
            <input name="easy" type="number" min={0} defaultValue={2} className="w-20 rounded-lg border px-2 py-2" /> سهل
            <input name="mid" type="number" min={0} defaultValue={2} className="w-20 rounded-lg border px-2 py-2" /> متوسط
            <input name="hard" type="number" min={0} defaultValue={1} className="w-20 rounded-lg border px-2 py-2" /> صعب
          </div>
          <button className="btn-primary sm:col-span-2">توليد الآن</button>
        </form>
      </div>

      <ul className="space-y-3">
        {[
          { id: "demo-exam-1", title: "امتحان الوحدة الأولى", qs: 5, mins: 30 },
          { id: "demo2", title: "مراجعة نيوتن", qs: 10, mins: 45 },
        ].map((ex) => (
          <li key={ex.id} className="card flex items-center justify-between p-4">
            <div>
              <div className="text-small font-bold">{ex.title}</div>
              <div className="text-xs text-slate-500">{ex.qs} أسئلة · {ex.mins} دقيقة</div>
            </div>
            <a href={`/exam/${ex.id}`} className="btn-secondary !px-4 !py-1.5 text-xs">حل</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
