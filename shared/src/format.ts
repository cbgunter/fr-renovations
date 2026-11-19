/**
 * Formatting helpers that follow BRAND.md section 2 "Formats".
 * All dates/times in the app are local Downers Grove time (America/Chicago).
 */
import { TIME_ZONE } from './types';

/** $38,500 - no cents unless needed. */
export function money(n: number): string {
  const hasCents = Math.round(n * 100) % 100 !== 0;
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  });
}

/** "$13,300 – $16,300" (en dash with spaces). */
export const moneyRange = (lo: number, hi: number) => `${money(lo)} – ${money(hi)}`;

/** (630) 555-0142. Leaves anything that isn't a 10-digit US number alone. */
export function phone(raw: string): string {
  const d = (raw || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  if (d.length !== 10) return raw || '';
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Digits only, for tel:/sms: links. */
export const phoneDigits = (raw: string) => (raw || '').replace(/[^\d+]/g, '');

/** "HH:mm" -> "8:00a" / "3:30p"; compact drops ":00" -> "9a". */
export function time(hhmm: string, compact = false): string {
  const [hs, ms] = hhmm.split(':');
  const h = Number(hs);
  const m = Number(ms ?? 0);
  const suffix = h < 12 ? 'a' : 'p';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  if (compact && m === 0) return `${h12}${suffix}`;
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

/** "8:00 – 9:00a" - suffix only once if both share it, per the brand range format. */
export function timeRange(a: string, b: string): string {
  const ta = time(a);
  const tb = time(b);
  if (ta.slice(-1) === tb.slice(-1)) return `${ta.slice(0, -1)} – ${tb}`;
  return `${ta} – ${tb}`;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parse "YYYY-MM-DD" as a calendar date with no time-zone drift. */
export function parseDay(day: string): { y: number; m: number; d: number; dow: number } {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, dow };
}

/** "Thu, Nov 19" */
export function dayLong(day: string): string {
  const p = parseDay(day);
  return `${DOW[p.dow]}, ${MON[p.m - 1]} ${p.d}`;
}

/** "Nov 19" */
export function dayShort(day: string): string {
  const p = parseDay(day);
  return `${MON[p.m - 1]} ${p.d}`;
}

export const dowShort = (day: string) => DOW[parseDay(day).dow];

/** Add days to "YYYY-MM-DD". */
export function addDays(day: string, n: number): string {
  const p = parseDay(day);
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return dt.toISOString().slice(0, 10);
}

/** Monday of the week containing `day`. */
export function weekStart(day: string): string {
  const dow = parseDay(day).dow;
  return addDays(day, dow === 0 ? -6 : 1 - dow);
}

/** Days between two "YYYY-MM-DD" (b - a). */
export function dayDiff(a: string, b: string): number {
  const pa = parseDay(a);
  const pb = parseDay(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}

/** Current local wall-clock time in Downers Grove as { day: "YYYY-MM-DD", time: "HH:mm" }. */
export function nowLocal(at: Date = new Date()): { day: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { day: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` };
}

/** For an ISO UTC timestamp: "Today 7:12a", "Yesterday 3:30p" or "Nov 11". */
export function recent(iso: string, now: Date = new Date()): string {
  const at = nowLocal(new Date(iso));
  const today = nowLocal(now).day;
  if (at.day === today) return `Today ${time(at.time)}`;
  if (at.day === addDays(today, -1)) return `Yesterday ${time(at.time)}`;
  return dayShort(at.day);
}

/** "224 sq ft" etc. */
export const measure = (n: number, unit: string) => `${n.toLocaleString('en-US')} ${unit}`;
