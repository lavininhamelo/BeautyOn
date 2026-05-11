import { toDate } from 'date-fns-tz';

export function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) {
    return null;
  }
  return { y, m: mo, d };
}

export function zonedDayStartUtc(ymd: string, timeZone: string): Date {
  if (!parseYmd(ymd)) throw new Error('Invalid YYYY-MM-DD');
  return toDate(`${ymd}T00:00:00`, { timeZone });
}

export function zonedDayEndUtc(ymd: string, timeZone: string): Date {
  if (!parseYmd(ymd)) throw new Error('Invalid YYYY-MM-DD');
  return toDate(`${ymd}T23:59:59.999`, { timeZone });
}

export function slotWallToUtc(
  ymd: string,
  hhmm: string,
  timeZone: string,
): Date {
  if (!parseYmd(ymd)) throw new Error('Invalid YYYY-MM-DD');
  const [hh, mm = '0'] = hhmm.split(':');
  const h = hh.padStart(2, '0');
  const mi = String(mm).padStart(2, '0');
  return toDate(`${ymd}T${h}:${mi}:00`, { timeZone });
}
