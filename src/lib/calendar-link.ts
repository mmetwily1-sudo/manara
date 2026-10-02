/**
 * رابط "أضف للتقويم" — يعمل بدون أي ربط (template رسمي من جوجل).
 * يفتح تقويم العميل (موبايل/كمبيوتر) مملوءاً بالبيانات.
 */

function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

/** أقرب وقوع ليوم أسبوع (0=الأحد) مع وقت "HH:MM" */
export function nextWeekday(weekday: number, time: string): Date {
  const [h, m] = time.split(":").map((x) => parseInt(x, 10) || 0);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  let diff = (weekday - d.getDay() + 7) % 7;
  if (diff === 0 && d.getTime() <= Date.now()) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60000);
}

export function googleCalendarTemplate(opts: {
  title: string;
  start: Date;
  end: Date;
  details?: string;
  location?: string;
}): string {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${fmt(opts.start)}/${fmt(opts.end)}`,
  });
  if (opts.details) q.set("details", opts.details);
  if (opts.location) q.set("location", opts.location);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** مدة "HH:MM–HH:MM" بالدقائق */
export function slotMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map((x) => parseInt(x, 10) || 0);
  const [eh, em] = end.split(":").map((x) => parseInt(x, 10) || 0);
  return Math.max(15, (eh * 60 + em) - (sh * 60 + sm));
}
