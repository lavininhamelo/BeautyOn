import type { Request, Response } from 'express';
import { z } from 'zod';

import { prisma } from '../../lib/prisma.js';
import { PROVIDER_SCHEDULE_HOURS } from '../../lib/providerSchedule.js';

function ymdTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;

const PutSchema = z.object({
  weekly: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        hours: z.array(z.string().regex(/^\d{2}:\d{2}$/)),
      }),
    )
    .optional(),
  overrides: z
    .array(
      z.object({
        dateYmd: z.string().regex(ymdRegex),
        time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
        enabled: z.boolean().nullable(),
      }),
    )
    .optional(),
});

async function ensureProvider(userId: number | undefined): Promise<{ id: number }> {
  const id = typeof userId === 'number' ? userId : Number(userId);
  if (!Number.isFinite(id)) {
    throw new Error('invalid_user');
  }
  const provider = await prisma.user.findFirst({
    where: { id, provider: true },
    select: { id: true },
  });
  if (!provider) {
    throw new Error('not_provider');
  }
  return provider;
}

class ProviderScheduleConfigController {
  async show(req: Request, res: Response) {
    try {
      const provider = await ensureProvider(req.userId);

      const from = typeof req.query.from === 'string' && ymdRegex.test(req.query.from)
        ? req.query.from
        : ymdTodayUtc();
      const to = typeof req.query.to === 'string' && ymdRegex.test(req.query.to) ? req.query.to : from;

      const [weeklyRows, overrideRows] = await Promise.all([
        prisma.providerWeeklyHour.findMany({
          where: { providerId: provider.id, enabled: true },
          select: { weekday: true, time: true },
        }),
        prisma.providerDateOverride.findMany({
          where: {
            providerId: provider.id,
            dateYmd: { gte: from, lte: to },
          },
          select: { dateYmd: true, time: true, enabled: true },
          orderBy: [{ dateYmd: 'asc' }, { time: 'asc' }],
        }),
      ]);

      const weekly: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
      for (const row of weeklyRows) {
        weekly[row.weekday] = weekly[row.weekday] || [];
        weekly[row.weekday].push(row.time);
      }
      for (const k of Object.keys(weekly)) {
        weekly[Number(k)].sort((a, b) => a.localeCompare(b));
      }

      return res.json({
        weekly,
        overrides: overrideRows.map(o => ({
          date_ymd: o.dateYmd,
          time: o.time,
          enabled: o.enabled,
        })),
        allowed_hours: PROVIDER_SCHEDULE_HOURS,
      });
    } catch (e) {
      if (e instanceof Error && e.message === 'not_provider') {
        return res.status(403).json({ error: 'User is not a provider' });
      }
      return res.status(400).json({ error: 'Invalid request' });
    }
  }

  async upsert(req: Request, res: Response) {
    try {
      const provider = await ensureProvider(req.userId);

      const parsed = PutSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid payload' });
      }
      const { weekly, overrides } = parsed.data;

      if (weekly) {
        await prisma.providerWeeklyHour.deleteMany({ where: { providerId: provider.id } });
        const toCreate: { providerId: number; weekday: number; time: string; enabled: boolean }[] = [];
        for (const w of weekly) {
          const weekday = w.weekday;
          if (!Number.isFinite(weekday) || weekday < 0 || weekday > 6) continue;
          for (const time of w.hours) {
            if (!(PROVIDER_SCHEDULE_HOURS as readonly string[]).includes(time)) continue;
            toCreate.push({ providerId: provider.id, weekday, time, enabled: true });
          }
        }
        if (toCreate.length > 0) {
          await prisma.providerWeeklyHour.createMany({ data: toCreate });
        }
      }

      if (overrides) {
        for (const o of overrides) {
          const time = o.time === undefined ? null : o.time;
          if (o.enabled === null) {
            await prisma.providerDateOverride.deleteMany({
              where: { providerId: provider.id, dateYmd: o.dateYmd, time },
            });
            continue;
          }
          if (time === null) {
            const existing = await prisma.providerDateOverride.findFirst({
              where: { providerId: provider.id, dateYmd: o.dateYmd, time: null },
              select: { id: true },
            });
            if (existing) {
              await prisma.providerDateOverride.update({
                where: { id: existing.id },
                data: { enabled: o.enabled },
              });
            } else {
              await prisma.providerDateOverride.create({
                data: {
                  providerId: provider.id,
                  dateYmd: o.dateYmd,
                  time: null,
                  enabled: o.enabled,
                },
              });
            }
          } else {
            await prisma.providerDateOverride.upsert({
              where: {
                providerId_dateYmd_time: {
                  providerId: provider.id,
                  dateYmd: o.dateYmd,
                  time,
                },
              },
              create: {
                providerId: provider.id,
                dateYmd: o.dateYmd,
                time,
                enabled: o.enabled,
              },
              update: { enabled: o.enabled },
            });
          }
        }
      }

      return this.show(req, res);
    } catch (e) {
      if (e instanceof Error && e.message === 'not_provider') {
        return res.status(403).json({ error: 'User is not a provider' });
      }
      return res.status(400).json({ error: 'Invalid request' });
    }
  }
}

export default new ProviderScheduleConfigController();

