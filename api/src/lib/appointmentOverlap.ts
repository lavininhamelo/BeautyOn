import { addMinutes } from 'date-fns/addMinutes';
import { formatInTimeZone } from 'date-fns-tz';

export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 60;

export type AppointmentIntervalSource = {
  date: Date;
  durationMinutes: number | null;
};

export function appointmentEndUtc(a: AppointmentIntervalSource): Date {
  const d = a.durationMinutes ?? DEFAULT_APPOINTMENT_DURATION_MINUTES;
  return addMinutes(a.date, d);
}

export function intervalsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA < endB && startB < endA;
}

export function candidateEndsSameBookingDay(
  candidateStart: Date,
  durationMinutes: number,
  ymd: string,
  timeZone: string,
): boolean {
  const end = addMinutes(candidateStart, durationMinutes);
  return formatInTimeZone(end, timeZone, 'yyyy-MM-dd') === ymd;
}

export function conflictsWithAnyAppointment(
  candidateStart: Date,
  durationMinutes: number,
  appointments: AppointmentIntervalSource[],
  timeZone: string,
  ymd: string,
): boolean {
  if (!candidateEndsSameBookingDay(candidateStart, durationMinutes, ymd, timeZone)) {
    return true;
  }
  const candEnd = addMinutes(candidateStart, durationMinutes);
  for (const a of appointments) {
    const aEnd = appointmentEndUtc(a);
    if (intervalsOverlap(candidateStart, candEnd, a.date, aEnd)) {
      return true;
    }
  }
  return false;
}
