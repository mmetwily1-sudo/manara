/**
 * تدقيق الغياب الصامت (no-show): حصص مضت بلا أي تسجيل حضور رغم وجود مسجلين.
 * - لا يكتب attendance أبداً ولا يشعر الأهالي — فقط ينبه المالك لمراجعة الحصة.
 *   (كتابة absent تلقائية = اتهام كاذب محتمل؛ التأكيد البشري يبقى عبر المسار القائم.)
 * - نافذة 3 أيام فقط (لا كشف رجعي)، حد 50 سنتراً و30 حصة للسنتر.
 * - رسالة واحدة للسنتر يومياً (dedupe على مستوى اليوم لا الحصة — بلا إزعاج).
 */

const DAY = 24 * 60 * 60 * 1000;

export async function runAttendanceAudit(admin: any) {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const now = new Date();
  const from = day(new Date(now.getTime() - 3 * DAY));
  const today = day(now);
  const { data: tenants } = await admin.from("tenants")
    .select("id,name").eq("status", "active").limit(50);
  let checked = 0, flagged = 0;
  const { notifyOwner } = await import("./notify");
  for (const t of (tenants ?? []) as any[]) {
    try {
      checked++;
      const { data: sess } = await admin.from("sessions")
        .select("id,session_date,group_id").eq("tenant_id", t.id)
        .gte("session_date", from).lt("session_date", today)
        .neq("status", "cancelled").limit(30);
      if (!sess?.length) continue;
      const gids: string[] = [];
      (sess as any[]).forEach((s) => { if (s.group_id && !gids.includes(s.group_id)) gids.push(s.group_id); });
      let enrolled = new Set<string>();
      if (gids.length) {
        const { data: en } = await admin.from("enrollments").select("group_id")
          .eq("tenant_id", t.id).eq("status", "active").in("group_id", gids).limit(2000);
        enrolled = new Set(((en ?? []) as any[]).map((r) => r.group_id));
      }
      const { data: att } = await admin.from("attendance").select("session_id")
        .eq("tenant_id", t.id).in("session_id", (sess as any[]).map((s) => s.id)).limit(2000);
      const hasAtt = new Set(((att ?? []) as any[]).map((r) => r.session_id));
      const missing = (sess as any[]).filter((s) => enrolled.has(s.group_id) && !hasAtt.has(s.id));
      if (!missing.length) continue;
      const seen: Record<string, true> = {};
      const missGids: string[] = [];
      missing.forEach((s) => { if (s.group_id && !seen[s.group_id]) { seen[s.group_id] = true; missGids.push(s.group_id); } });
      const { data: groups } = await admin.from("groups").select("id,name")
        .eq("tenant_id", t.id).in("id", missGids.length ? missGids : ["00000000-0000-0000-0000-000000000000"]).limit(20);
      const gname: Record<string, string> = {};
      for (const g of (groups ?? []) as any[]) gname[g.id] = g.name ?? "";
      const lines = missing.slice(0, 5).map((s) => {
        const dd = String(s.session_date ?? "").slice(0, 10);
        return `${dd}${gname[s.group_id] ? ` (${gname[s.group_id]})` : ""}`;
      });
      const more = missing.length > 5 ? ` +${missing.length - 5} أخرى` : "";
      await notifyOwner(admin, {
        tenantId: t.id,
        body: `تنبيه مراجعة منارة: ${missing.length} حصة بلا أي تسجيل حضور في سنتر ${t.name} — ${lines.join("، ")}${more}. راجعها من صفحة التحضير (لا يُرسل شيء لأولياء الأمور تلقائياً).`,
        event: "attendance_audit",
        dedupeKey: `audit:${t.id}:${today}`,
      });
      flagged++;
    } catch {}
  }
  return { checked, flagged };
}
