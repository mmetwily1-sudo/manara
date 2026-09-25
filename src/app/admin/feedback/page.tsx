import { createClient } from "@supabase/supabase-js";

const KIND: Record<string, string> = { nps: "تقييم ⭐", idea: "اقتراح 💡", bug: "بلاغ 🐞", praise: "شكر 🙏" };

/** /admin/feedback — صوت المعلمين: متوسط NPS + أحدث الرسائل */
export default async function AdminFeedback() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let avg: number | null = null;
  let counts: Record<string, number> = {};
  let rows: any[] = [];
  let openFollowups: number | null = null;

  if (url && key) {
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data: nps } = await admin.from("feedback").select("score").eq("kind", "nps").not("score", "is", null).limit(500);
    if (nps?.length) avg = Math.round((nps.reduce((s: number, r: any) => s + Number(r.score ?? 0), 0) / nps.length) * 10) / 10;
    const { data: all } = await admin.from("feedback").select("kind").limit(2000);
    (all ?? []).forEach((r: any) => { counts[r.kind] = (counts[r.kind] ?? 0) + 1; });
    const { data: latest } = await admin.from("feedback")
      .select("kind,score,text,page,created_at,tenants(name)")
      .order("created_at", { ascending: false }).limit(50);
    const { count: ofc } = await admin.from("support_tickets").select("id", { count: "exact", head: true })
      .eq("category", "nps_followup").eq("status", "open");
    openFollowups = ofc;
    rows = latest ?? [];
  }

  return (
    <div className="space-y-6">
      <h1 className="text-h1">صوت المعلمين 💬</h1>
      {(openFollowups ?? 0) > 0 && (
        <div className="card border-danger/30 bg-danger/5 p-4 text-small font-bold text-danger">
          🚨 {openFollowups} متابعة NPS منخفض مفتوحة — تواصل شخصياً خلال 24 ساعة قبل أن يغادر المعلم.
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="card p-5">
          <div className="text-h1 font-extrabold">{avg ?? "—"}</div>
          <div className="mt-1 text-small text-slate-500">متوسط التقييم /10</div>
        </div>
        {Object.entries(KIND).map(([k, l]) => (
          <div key={k} className="card p-5">
            <div className="text-h1 font-extrabold">{counts[k] ?? 0}</div>
            <div className="mt-1 text-small text-slate-500">{l}</div>
          </div>
        ))}
      </div>
      <ul className="space-y-3">
        {(rows as any[]).map((r: any, i: number) => (
          <li key={i} className="card space-y-1 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold">{KIND[r.kind] ?? r.kind}{r.score ? ` · ${r.score}/10` : ""}</span>
              <span className="text-slate-400">
                {(r.tenants as any)?.name ?? ""} · {String(r.created_at ?? "").slice(0, 10)}{r.page ? ` · ${r.page}` : ""}
              </span>
            </div>
            {r.text && <p className="text-small leading-relaxed">{r.text}</p>}
          </li>
        ))}
        {rows.length === 0 && <li className="card p-8 text-center text-small text-slate-400">لا رسائل بعد.</li>}
      </ul>
    </div>
  );
}
