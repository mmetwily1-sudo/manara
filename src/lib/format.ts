/** تنسيق موحد للأرقام والعملات والتواريخ (أرقام عربية مشرقية) */
const AR = "ar-EG";

export function num(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v.toLocaleString(AR) : "٠";
}

export function money(n: number | string | null | undefined, suffix = "ج"): string {
  return `${num(n)} ${suffix}`;
}

export function dateTime(d: string | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString(AR);
  } catch {
    return "";
  }
}

export function dateOnly(d: string | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString(AR);
  } catch {
    return "";
  }
}
