import type { Request, Response } from 'express';

import { bookingTimeZone } from '../../config/booking.js';
import {
  parseYmd,
  zonedDayEndUtc,
  zonedDayStartUtc,
} from '../../lib/bookingDates.js';
import { fileUrlForId } from '../../lib/fileUrl.js';
import { prisma } from '../../lib/prisma.js';

class ScheduleController {
  async index(req: Request, res: Response) {
    const checkUserProvider = await prisma.user.findFirst({
      where: {
        id: req.userId,
        provider: true,
      },
    });

    if (!checkUserProvider) {
      return res.status(400).json({ error: 'User is not a provider' });
    }

    const { date } = req.query;
    if (typeof date !== 'string' || !date || !parseYmd(date.trim())) {
      return res.status(400).json({ error: 'date is required' });
    }
    const ymd = date.trim();
    const tz = bookingTimeZone;
    const dayStart = zonedDayStartUtc(ymd, tz);
    const dayEnd = zonedDayEndUtc(ymd, tz);

    const appointments = await prisma.appointment.findMany({
      where: {
        providerId: req.userId,
        date: { gte: dayStart, lte: dayEnd },
      },
      include: {
        user: {
          select: {
            name: true,
            phone: true,
            avatar: { select: { id: true } },
          },
        },
        providerService: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });

    const payload = appointments.map(a => ({
      id: a.id,
      date: a.date,
      status: a.status,
      provider_id: a.providerId,
      service_id: a.providerService?.id ?? null,
      service_name: a.providerService?.name ?? null,
      user: {
        name: a.user?.name ?? a.guestName ?? 'Cliente',
        phone: a.user?.phone ?? a.guestPhone ?? null,
        is_guest: a.userId == null,
        avatar_url: a.user?.avatar ? fileUrlForId(a.user.avatar.id) : undefined,
      },
    }));

    return res.json(payload);
  }
}

export default new ScheduleController();
