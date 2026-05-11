import { format, parseISO, setHours, setMinutes } from 'date-fns';

export type WeeklyMap = Record<string, string[]>;

export type OverrideRow = {
  date_ymd: string;
  time: string | null;
  enabled: boolean;
};

export type ScheduleConfigResponse = {
  weekly: WeeklyMap;
  overrides: OverrideRow[];
  allowed_hours: string[];
};

export type LocalOverrideValue = boolean | null;

export const DEFAULT_PROVIDER_ALLOWED_HOURS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
];

export function keyFor(dateYmd: string, time: string | null): string {
  return `${dateYmd}::${time ?? '__day__'}`;
}

export function dowFromYmd(ymd: string): number {
  return parseISO(`${ymd}T12:00:00`).getDay();
}

export function baseHoursForDate(weekly: WeeklyMap, ymd: string): Set<string> {
  const dow = dowFromYmd(ymd);
  const hours = weekly[String(dow)] || [];
  return new Set(hours);
}

export function applyOverrides(
  base: Set<string>,
  allowed: string[],
  ymd: string,
  serverOverrides: Map<string, boolean>,
  localOverrides: Map<string, LocalOverrideValue>,
): Set<string> {
  const next = new Set(base);

  const dayKey = keyFor(ymd, null);
  const localDay = localOverrides.has(dayKey)
    ? localOverrides.get(dayKey)
    : undefined;
  const serverDay = serverOverrides.get(dayKey);

  const dayDecision = localDay !== undefined ? localDay : serverDay;
  if (dayDecision === false) {
    next.clear();
    return next;
  }
  if (dayDecision === true && next.size === 0) {
    for (const t of allowed) next.add(t);
  }

  for (const t of allowed) {
    const k = keyFor(ymd, t);
    const local = localOverrides.has(k) ? localOverrides.get(k) : undefined;
    const server = serverOverrides.get(k);
    const v = local !== undefined ? local : server;
    if (v === true) next.add(t);
    if (v === false) next.delete(t);
  }

  return next;
}

export function overridesArrayToMap(overrides: OverrideRow[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const o of overrides || []) {
    map.set(keyFor(o.date_ymd, o.time), o.enabled);
  }
  return map;
}

export function effectiveHoursServerOnly(
  weekly: WeeklyMap,
  allowedHours: string[],
  ymd: string,
  serverOverrides: Map<string, boolean>,
): Set<string> {
  const base = baseHoursForDate(weekly, ymd);
  return applyOverrides(
    base,
    allowedHours,
    ymd,
    serverOverrides,
    new Map(),
  );
}

export function isTimeAllowed(slotStart: Date, effective: Set<string>): boolean {
  const exact = format(slotStart, 'HH:mm');
  if (effective.has(exact)) return true;
  const hourFloor = format(
    setMinutes(setHours(slotStart, slotStart.getHours()), 0),
    'HH:mm',
  );
  if (effective.has(hourFloor)) return true;
  return false;
}

export function isSlotAllowedForProvider(
  slotStart: Date,
  weekly: WeeklyMap,
  allowedHours: string[],
  serverOverrides: Map<string, boolean>,
): boolean {
  const ymd = format(slotStart, 'yyyy-MM-dd');
  const effective = effectiveHoursServerOnly(
    weekly,
    allowedHours,
    ymd,
    serverOverrides,
  );
  return isTimeAllowed(slotStart, effective);
}
