import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export const PROVIDER_SCHEDULE_HOURS = [
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
] as const;

export function isClosedBookingDay(date: Date, timeZone: string): boolean {
  const z = toZonedTime(date, timeZone);
  const dow = z.getDay();
  return dow === 0 || dow === 6;
}

export function isAllowedScheduleHour(date: Date, timeZone: string): boolean {
  const label = formatInTimeZone(date, timeZone, 'HH:mm');
  return (PROVIDER_SCHEDULE_HOURS as readonly string[]).includes(label);
}
