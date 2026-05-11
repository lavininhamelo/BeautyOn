import { isAfter } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { Request, Response } from 'express';

import { bookingTimeZone } from '../../config/booking.js';
import {
  parseYmd,
  slotWallToUtc,
  zonedDayEndUtc,
  zonedDayStartUtc,
} from '../../lib/bookingDates.js';
import { conflictsWithAnyAppointment } from '../../lib/appointmentOverlap.js';
import {
  PROVIDER_SCHEDULE_HOURS,
} from '../../lib/providerSchedule.js';
import { prisma } from '../../lib/prisma.js';

function weekdayInTimeZone(dayStartUtc: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  }).formatToParts(dayStartUtc);
  const w = parts.find(p => p.type === 'weekday')?.value;
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return typeof w === 'string' && w in map ? map[w] : new Date(dayStartUtc).getUTCDay();
}

class AvailableController {
  async index(req: Request, res: Response) {
    const raw = req.query.date;
    if (raw === undefined || raw === null || raw === '') {
      return res.status(400).json({ error: 'Invalid date' });
    }

    let ymd: string;
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
      ymd = raw.trim();
      if (!parseYmd(ymd)) {
        return res.status(400).json({ error: 'Invalid date' });
      }
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        return res.status(400).json({ error: 'Invalid date' });
      }
      ymd = formatInTimeZone(new Date(n), bookingTimeZone, 'yyyy-MM-dd');
    }

    const serviceId = Number(req.query.service_id);
    if (Number.isNaN(serviceId)) {
      return res.status(400).json({ error: 'service_id é obrigatório' });
    }

    const providerId = Number(req.params.providerId);
    if (Number.isNaN(providerId)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    const service = await prisma.providerService.findFirst({
      where: { id: serviceId, providerId },
    });
    if (!service) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    const duration = service.durationMinutes;
    const tz = bookingTimeZone;
    const dayStart = zonedDayStartUtc(ymd, tz);
    const dayEnd = zonedDayEndUtc(ymd, tz);
    const weekday = weekdayInTimeZone(dayStart, tz);

    const [appointments, weeklyHours, overrides] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          providerId,
          canceledAt: null,
          date: { gte: dayStart, lte: dayEnd },
        },
        select: {
          date: true,
          durationMinutes: true,
        },
      }),
      prisma.providerWeeklyHour.findMany({
        where: { providerId, weekday, enabled: true },
        select: { time: true },
      }),
      prisma.providerDateOverride.findMany({
        where: { providerId, dateYmd: ymd },
        select: { time: true, enabled: true },
      }),
    ]);

    const intervalSources = appointments.map(a => ({
      date: a.date,
      durationMinutes: a.durationMinutes,
    }));

    const orderIndex = new Map<string, number>(
      (PROVIDER_SCHEDULE_HOURS as readonly string[]).map((t, i) => [t, i]),
    );

    const dayOverride = overrides.find(o => o.time == null);
    const perHour = overrides.filter(o => o.time != null) as { time: string; enabled: boolean }[];

    const base = new Set<string>(weeklyHours.map(r => r.time));

    if (dayOverride?.enabled === true && base.size === 0) {
      for (const t of PROVIDER_SCHEDULE_HOURS) base.add(t);
    }

    if (dayOverride?.enabled === false) {
      base.clear();
    }

    for (const o of perHour) {
      if (!(orderIndex as Map<string, number>).has(o.time)) continue;
      if (o.enabled) base.add(o.time);
      else base.delete(o.time);
    }

    const schedule = Array.from(base).sort(
      (a, b) => (orderIndex.get(a) ?? 999) - (orderIndex.get(b) ?? 999),
    );

    const available = schedule.map(time => {
      const value = slotWallToUtc(ymd, time, tz);

      const conflict =
        conflictsWithAnyAppointment(value, duration, intervalSources, tz, ymd);

      return {
        time,
        value: formatInTimeZone(value, tz, "yyyy-MM-dd'T'HH:mm:ssXXX"),
        available:
          !conflict &&
          isAfter(value, new Date()),
      };
    });

    return res.json(available);
  }
}

export default new AvailableController();
