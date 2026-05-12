import { z } from 'zod';
import type { Request, Response } from 'express';
import {
  startOfHour,
  parseISO,
  isBefore,
  subHours,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { pt } from 'date-fns/locale/pt';
import {
  PROVIDER_SCHEDULE_HOURS,
} from '../../lib/providerSchedule.js';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

import { bookingTimeZone } from '../../config/booking.js';
import {
  zonedDayEndUtc,
  zonedDayStartUtc,
} from '../../lib/bookingDates.js';
import { conflictsWithAnyAppointment } from '../../lib/appointmentOverlap.js';
import { prisma } from '../../lib/prisma.js';
import { appointmentListItem } from '../../lib/appointmentView.js';
import { fileUrlForId } from '../../lib/fileUrl.js';

import CancellationMail from '../jobs/CancellationMail.js';
import Queue from '../../lib/Queue.js';
import { normalizePhoneForStorage } from '../../lib/phoneNormalize.js';

function notifyProviderLater(content: string, providerUserId: number): void {
  void prisma.notification
    .create({
      data: {
        content,
        userId: providerUserId,
      },
    })
    .catch((err: unknown) => {
      console.error('[BeautyOn] Failed to save notification:', err);
    });
}

type ValidatedBookingSlot = {
  hourStart: Date;
  providerId: number;
  service: {
    id: number;
    durationMinutes: number;
    name: string;
    isEvaluation: boolean;
    requiresPriorEvaluation: boolean;
    priceCents: number;
  };
  ymd: string;
};

class AppointmentController {
  private async upsertProviderClientLink(params: {
    providerId: number;
    phoneNormalized: string;
    name: string;
    email?: string | null;
  }): Promise<{ clientId: number }> {
    const { providerId, phoneNormalized, name, email } = params;

    const client = await prisma.client.upsert({
      where: { phone: phoneNormalized },
      create: {
        phone: phoneNormalized,
        name: name.trim() || 'Cliente',
        email: email?.trim() || null,
      },
      update: {
        name: name.trim() || 'Cliente',
        ...(email !== undefined ? { email: email?.trim() || null } : {}),
      },
      select: { id: true },
    });

    await prisma.providerClient.upsert({
      where: {
        providerId_clientId: {
          providerId,
          clientId: client.id,
        },
      },
      create: {
        providerId,
        clientId: client.id,
      },
      update: {},
      select: { id: true },
    });

    return { clientId: client.id };
  }

  private async autoCancelExpiredForUser(userId: number): Promise<void> {
    await prisma.appointment.updateMany({
      where: {
        userId,
        status: 'scheduled',
        date: { lt: new Date() },
        canceledAt: null,
      },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
        statusUpdatedAt: new Date(),
      },
    });
  }

  private async validateNewBooking(params: {
    providerId: number;
    providerServiceId: number;
    date: string | Date;
    selfUserId: number | null;
    phoneNormalized?: string;
    /**
     * Quando a profissional marca em nome da cliente (`storeForClient`), não se exige
     * linha em `provider_client_clearances`. Em auto-marcação ou convidado, serviços
     * com `requires_prior_evaluation` exigem a cliente estar “Avaliada” (clearance).
     */
    enforceClientEvalClearance?: boolean;
  }): Promise<
    | { ok: true; data: ValidatedBookingSlot }
    | { ok: false; status: number; error: string }
  > {
    const { providerId, providerServiceId, date, selfUserId } = params;

    const isProvider = await prisma.user.findFirst({
      where: { id: providerId, provider: true },
    });

    if (!isProvider) {
      return { ok: false, status: 401, error: 'Só é possível criar marcações com profissionais.' };
    }

    const service = await prisma.providerService.findFirst({
      where: {
        id: providerServiceId,
        providerId,
      },
      select: {
        id: true,
        name: true,
        durationMinutes: true,
        isEvaluation: true,
        requiresPriorEvaluation: true,
        priceCents: true,
      },
    });

    if (!service) {
      return { ok: false, status: 400, error: 'Serviço inválido para este profissional.' };
    }

    const hourStart = startOfHour(parseISO(String(date)));
    const tz = bookingTimeZone;
    const duration = service.durationMinutes;

    if (isBefore(hourStart, new Date())) {
      return { ok: false, status: 400, error: 'Não é permitido marcar no passado.' };
    }

    const ymd = formatInTimeZone(hourStart, tz, 'yyyy-MM-dd');
    const timeLabel = formatInTimeZone(hourStart, tz, 'HH:mm');
    const weekday = toZonedTime(hourStart, tz).getDay();

    const [weeklyHours, overrides] = await Promise.all([
      prisma.providerWeeklyHour.findMany({
        where: { providerId, weekday, enabled: true },
        select: { time: true },
      }),
      prisma.providerDateOverride.findMany({
        where: { providerId, dateYmd: ymd },
        select: { time: true, enabled: true },
      }),
    ]);

    const orderIndex = new Map<string, number>(
      (PROVIDER_SCHEDULE_HOURS as readonly string[]).map((t, i) => [t, i]),
    );

    const dayOverride = overrides.find(o => o.time == null);
    const perHour = overrides.filter(o => o.time != null) as {
      time: string;
      enabled: boolean;
    }[];

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

    if (base.size === 0) {
      return { ok: false, status: 400, error: 'Este dia não está disponível para marcação.' };
    }

    if (!base.has(timeLabel)) {
      return { ok: false, status: 400, error: 'Este horário não está disponível para marcação.' };
    }

    const dayStart = zonedDayStartUtc(ymd, tz);
    const dayEnd = zonedDayEndUtc(ymd, tz);

    const sameDayAppointments = await prisma.appointment.findMany({
      where: {
        providerId,
        canceledAt: null,
        date: { gte: dayStart, lte: dayEnd },
      },
      select: {
        date: true,
        durationMinutes: true,
      },
    });

    if (
      conflictsWithAnyAppointment(
        hourStart,
        duration,
        sameDayAppointments,
        tz,
        ymd,
      )
    ) {
      return { ok: false, status: 400, error: 'Este horário já não está disponível.' };
    }

    if (selfUserId !== null && selfUserId === providerId) {
      return {
        ok: false,
        status: 400,
        error: 'Não é possível marcar consigo próprio.',
      };
    }

    const requiresPrior = service.requiresPriorEvaluation === true;
    const mustCheckClientClearance = requiresPrior && params.enforceClientEvalClearance !== false;
    if (mustCheckClientClearance) {
      let phoneNormalized: string | undefined = params.phoneNormalized;
      if (phoneNormalized) {
        try {
          phoneNormalized = normalizePhoneForStorage(phoneNormalized);
        } catch {
          phoneNormalized = undefined;
        }
      }

      if (!phoneNormalized && selfUserId) {
        const u = await prisma.user.findUnique({
          where: { id: selfUserId },
          select: { phone: true },
        });
        const raw = u?.phone ?? undefined;
        if (raw) {
          try {
            phoneNormalized = normalizePhoneForStorage(raw);
          } catch {
            phoneNormalized = undefined;
          }
        }
      }

      if (!phoneNormalized) {
        return {
          ok: false,
          status: 400,
          error:
            'Para este serviço precisas de telemóvel no perfil ou no agendamento, e de a profissional te marcar como Avaliada antes de marcares sozinha.',
        };
      }

      const clearance = await prisma.providerClientClearance.findUnique({
        where: {
          providerId_phoneNormalized: {
            providerId,
            phoneNormalized,
          },
        },
        select: { id: true },
      });
      if (!clearance) {
        return {
          ok: false,
          status: 400,
          error:
            'Este serviço só podes marcar depois de a profissional te marcar como Avaliada (lista de clientes). Ela também pode marcar por ti.',
        };
      }
    }

    return {
      ok: true,
      data: {
        hourStart,
        providerId,
        service: {
          id: service.id,
          durationMinutes: service.durationMinutes,
          name: service.name,
          isEvaluation: service.isEvaluation,
          requiresPriorEvaluation: service.requiresPriorEvaluation,
          priceCents: service.priceCents,
        },
        ymd,
      },
    };
  }

  async me(req: Request, res: Response) {
    await this.autoCancelExpiredForUser(req.userId!);
    const { year, month, day, page = 1 } = req.query;

    const y = year !== undefined ? Number(year) : NaN;
    const m = month !== undefined ? Number(month) : NaN;
    const d = day !== undefined ? Number(day) : NaN;

    const anyCalendarParam =
      year !== undefined || month !== undefined || day !== undefined;

    const hasCalendar =
      Number.isFinite(y) &&
      Number.isFinite(m) &&
      Number.isFinite(d) &&
      m >= 1 &&
      m <= 12 &&
      d >= 1 &&
      d <= 31;

    if (anyCalendarParam && !hasCalendar) {
      return res.status(400).json({
        error: 'Data inválida',
        detail:
          'Use year, month (1–12) e day juntos (ex: ?year=2026&month=4&day=9)',
      });
    }

    const p = Math.max(1, Number(page) || 1);

    const baseWhere = {
      userId: req.userId,
    };

    if (hasCalendar) {
      const calendarDate = new Date(y, m - 1, d);
      const dayStart = startOfDay(calendarDate);
      const dayEnd = endOfDay(calendarDate);

      const rows = await prisma.appointment.findMany({
        where: {
          ...baseWhere,
          date: { gte: dayStart, lte: dayEnd },
        },
        orderBy: { date: 'asc' },
        select: {
          id: true,
          date: true,
          status: true,
          canceledAt: true,
          providerService: {
            select: {
              id: true,
              name: true,
              durationMinutes: true,
              priceCents: true,
            },
          },
          provider: {
            select: {
              id: true,
              name: true,
              avatar: { select: { id: true } },
            },
          },
        },
      });

      return res.json(
        rows
          .filter((r): r is typeof r & { provider: NonNullable<typeof r.provider> } => r.provider != null)
          .map(r =>
            appointmentListItem({
              id: r.id,
              date: r.date,
              status: r.status,
              canceledAt: r.canceledAt,
              providerService: r.providerService,
              provider: { ...r.provider, avatar: r.provider.avatar },
            })
          )
      );
    }

    const rows = await prisma.appointment.findMany({
      where: baseWhere,
      orderBy: { date: 'asc' },
      select: {
        id: true,
        date: true,
        status: true,
        canceledAt: true,
        providerService: {
          select: {
            id: true,
            name: true,
            durationMinutes: true,
            priceCents: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
            avatar: { select: { id: true } },
          },
        },
      },
      take: 20,
      skip: (p - 1) * 20,
    });

    return res.json(
      rows
        .filter((r): r is typeof r & { provider: NonNullable<typeof r.provider> } => r.provider != null)
        .map(r =>
          appointmentListItem({
            id: r.id,
            date: r.date,
            status: r.status,
            canceledAt: r.canceledAt,
            providerService: r.providerService,
            provider: { ...r.provider, avatar: r.provider.avatar },
          })
        )
    );
  }

  async index(req: Request, res: Response) {
    const { page = 1 } = req.query;
    const p = Math.max(1, Number(page) || 1);

    const rows = await prisma.appointment.findMany({
      where: { userId: req.userId, canceledAt: null },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        date: true,
        providerService: {
          select: {
            id: true,
            name: true,
            durationMinutes: true,
            priceCents: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
            avatar: { select: { id: true } },
          },
        },
      },
      take: 20,
      skip: (p - 1) * 20,
    });

    return res.json(
      rows
        .filter((r): r is typeof r & { provider: NonNullable<typeof r.provider> } => r.provider != null)
        .map(r =>
          appointmentListItem({
            id: r.id,
            date: r.date,
            providerService: r.providerService,
            provider: { ...r.provider, avatar: r.provider.avatar },
          })
        )
    );
  }

  async store(req: Request, res: Response) {
    const schema = z.object({
      provider_id: z.number(),
      provider_service_id: z.number().int(),
      date: z.union([z.string().min(1), z.date()]),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Falha na validação', issues: parsed.error.issues });
    }

    const { provider_id, provider_service_id, date } = parsed.data;

    const v = await this.validateNewBooking({
      providerId: provider_id,
      providerServiceId: provider_service_id,
      date,
      selfUserId: req.userId ?? null,
    });
    if (!v.ok) {
      return res.status(v.status).json({ error: v.error });
    }

    const { hourStart, service } = v.data;
    const duration = service.durationMinutes;
    const tz = bookingTimeZone;

    let linkedClientId: number | null = null;
    const me = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { name: true, phone: true, email: true },
    });
    if (me?.phone) {
      const link = await this.upsertProviderClientLink({
        providerId: provider_id,
        phoneNormalized: me.phone,
        name: me.name,
        email: me.email,
      });
      linkedClientId = link.clientId;
    }

    const appointment = await prisma.appointment.create({
      data: {
        userId: req.userId,
        clientId: linkedClientId,
        providerId: provider_id,
        providerServiceId: service.id,
        durationMinutes: duration,
        date: hourStart,
        status: 'scheduled',
        statusUpdatedAt: new Date(),
      },
    });

    const name = me?.name ?? '';
    const phonePart = me?.phone ? ` · ${me.phone}` : '';

    const formattedDate = formatInTimeZone(
      hourStart,
      tz,
      "dd 'de' MMMM 'às' HH:mm",
      { locale: pt },
    );

    notifyProviderLater(
      `Novo agendamento de ${name}${phonePart}: ${service.name} · ${formattedDate}`,
      provider_id,
    );

    return res.json(appointment);
  }

  async updateStatus(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const schema = z.object({
      status: z.enum(['scheduled', 'attended', 'canceled', 'no_show']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.issues });
    }

    const appt = await prisma.appointment.findFirst({
      where: { id, providerId: req.userId },
      select: { id: true },
    });
    if (!appt) {
      return res.status(404).json({ error: 'Marcação não encontrada' });
    }

    const status = parsed.data.status;
    const next = await prisma.appointment.update({
      where: { id },
      data: {
        status,
        statusUpdatedAt: new Date(),
        canceledAt: status === 'canceled' ? new Date() : undefined,
      },
      select: { id: true, status: true, statusUpdatedAt: true },
    });

    return res.json({
      id: next.id,
      status: next.status,
      status_updated_at: next.statusUpdatedAt.toISOString(),
    });
  }

  async reschedule(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const schema = z.object({
      date: z.union([z.string().min(1), z.date()]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.issues });
    }

    const appt = await prisma.appointment.findFirst({
      where: { id, providerId: req.userId },
      select: {
        id: true,
        userId: true,
        guestPhone: true,
        providerServiceId: true,
        user: { select: { phone: true } },
      },
    });
    if (!appt || !appt.providerServiceId) {
      return res.status(404).json({ error: 'Marcação não encontrada' });
    }

    const phoneNormalized = appt.user?.phone ?? appt.guestPhone ?? undefined;

    const v = await this.validateNewBooking({
      providerId: req.userId!,
      providerServiceId: appt.providerServiceId,
      date: parsed.data.date,
      selfUserId: appt.userId ?? null,
      phoneNormalized,
    });
    if (!v.ok) {
      return res.status(v.status).json({ error: v.error });
    }

    const next = await prisma.appointment.update({
      where: { id },
      data: {
        date: v.data.hourStart,
        durationMinutes: v.data.service.durationMinutes,
        providerServiceId: v.data.service.id,
        status: 'scheduled',
        statusUpdatedAt: new Date(),
        canceledAt: null,
      },
      select: { id: true, date: true, status: true },
    });

    return res.json(next);
  }

  async eligibility(req: Request, res: Response) {
    const providerId = Number(req.query.provider_id);
    if (Number.isNaN(providerId)) {
      return res.status(400).json({ error: 'provider_id é obrigatório' });
    }
    const me = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { phone: true, provider: true },
    });
    if (!me || me.provider) {
      return res.status(403).json({ error: 'Apenas clientes podem consultar elegibilidade.' });
    }
    if (!me.phone) {
      return res.json({ has_clearance: false, reason: 'missing_phone' });
    }
    let phoneKey: string;
    try {
      phoneKey = normalizePhoneForStorage(me.phone);
    } catch {
      return res.json({ has_clearance: false, reason: 'invalid_phone' });
    }
    const row = await prisma.providerClientClearance.findUnique({
      where: {
        providerId_phoneNormalized: {
          providerId,
          phoneNormalized: phoneKey,
        },
      },
      select: { id: true },
    });
    return res.json({ has_clearance: !!row });
  }

  async storeGuest(req: Request, res: Response) {
    const schema = z.object({
      provider_id: z.coerce.number().int(),
      provider_service_id: z.coerce.number().int(),
      date: z.union([z.string().min(1), z.date()]),
      guest_name: z.string().min(1).max(120).trim(),
      guest_phone: z.string().min(8).max(32),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Falha na validação', issues: parsed.error.issues });
    }

    let guestPhone: string;
    try {
      guestPhone = normalizePhoneForStorage(parsed.data.guest_phone);
    } catch {
      return res.status(400).json({ error: 'Telemóvel inválido.' });
    }

    const v = await this.validateNewBooking({
      providerId: parsed.data.provider_id,
      providerServiceId: parsed.data.provider_service_id,
      date: parsed.data.date,
      selfUserId: null,
      phoneNormalized: guestPhone,
    });
    if (!v.ok) {
      return res.status(v.status).json({ error: v.error });
    }

    const { hourStart, providerId, service } = v.data;
    const duration = service.durationMinutes;
    const tz = bookingTimeZone;
    const guestName = parsed.data.guest_name;

    const matchedUser = await prisma.user.findFirst({
      where: { phone: guestPhone, provider: false },
      select: { id: true, name: true },
    });

    const link = await this.upsertProviderClientLink({
      providerId,
      phoneNormalized: guestPhone,
      name: matchedUser?.name ?? parsed.data.guest_name,
    });

    const appointment = await prisma.appointment.create({
      data: {
        userId: matchedUser?.id ?? null,
        clientId: link.clientId,
        providerId,
        providerServiceId: service.id,
        durationMinutes: duration,
        date: hourStart,
        guestName: matchedUser ? null : guestName,
        guestPhone: matchedUser ? null : guestPhone,
        status: 'scheduled',
        statusUpdatedAt: new Date(),
      },
    });

    const formattedDate = formatInTimeZone(
      hourStart,
      tz,
      "dd 'de' MMMM 'às' HH:mm",
      { locale: pt },
    );

    const displayName = matchedUser?.name ?? guestName;
    const phonePart = matchedUser ? '' : ` · ${guestPhone}`;
    const modeLabel = matchedUser ? 'cliente reconhecido' : 'convidado';

    notifyProviderLater(
      `Novo agendamento (${modeLabel}) ${displayName}${phonePart}: ${service.name} · ${formattedDate}`,
      providerId,
    );

    return res.json(appointment);
  }

  async storeForClient(req: Request, res: Response) {
    const providerId = req.userId;
    if (!providerId) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const isProvider = await prisma.user.findFirst({
      where: { id: providerId, provider: true },
      select: { id: true },
    });
    if (!isProvider) {
      return res.status(403).json({ error: 'Apenas profissionais podem marcar para clientes.' });
    }

    const schema = z.object({
      provider_service_id: z.coerce.number().int(),
      date: z.union([z.string().min(1), z.date()]),
      client_name: z.string().min(1).max(120).trim(),
      client_phone: z.string().min(8).max(32),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Falha na validação', issues: parsed.error.issues });
    }

    let phone: string;
    try {
      phone = normalizePhoneForStorage(parsed.data.client_phone);
    } catch {
      return res.status(400).json({ error: 'Telemóvel inválido.' });
    }

    const matchedUser = await prisma.user.findFirst({
      where: { phone, provider: false },
      select: { id: true, name: true },
    });

    const v = await this.validateNewBooking({
      providerId,
      providerServiceId: parsed.data.provider_service_id,
      date: parsed.data.date,
      selfUserId: matchedUser?.id ?? null,
      phoneNormalized: phone,
      enforceClientEvalClearance: false,
    });
    if (!v.ok) {
      return res.status(v.status).json({ error: v.error });
    }

    const { hourStart, service } = v.data;
    const duration = service.durationMinutes;
    const tz = bookingTimeZone;

    const link = await this.upsertProviderClientLink({
      providerId,
      phoneNormalized: phone,
      name: matchedUser?.name ?? parsed.data.client_name,
    });

    const appointment = await prisma.appointment.create({
      data: {
        userId: matchedUser?.id ?? null,
        clientId: link.clientId,
        providerId,
        providerServiceId: service.id,
        durationMinutes: duration,
        date: hourStart,
        guestName: matchedUser ? null : parsed.data.client_name,
        guestPhone: matchedUser ? null : phone,
        status: 'scheduled',
        statusUpdatedAt: new Date(),
      },
    });

    const formattedDate = formatInTimeZone(
      hourStart,
      tz,
      "dd 'de' MMMM 'às' HH:mm",
      { locale: pt },
    );

    const displayName = matchedUser?.name ?? parsed.data.client_name;
    const phonePart = matchedUser ? '' : ` · ${phone}`;
    notifyProviderLater(
      `Novo agendamento (criado pelo profissional) ${displayName}${phonePart}: ${service.name} · ${formattedDate}`,
      providerId,
    );

    return res.status(201).json(appointment);
  }

  async lookupGuestByPhone(req: Request, res: Response) {
    const schema = z.object({
      phone: z.string().min(8).max(32),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Indica um telemóvel válido.' });
    }

    let normalized: string;
    try {
      normalized = normalizePhoneForStorage(parsed.data.phone);
    } catch {
      return res.status(400).json({ error: 'Telemóvel inválido.' });
    }

    const rows = await prisma.appointment.findMany({
      where: {
        OR: [
          { AND: [{ userId: null }, { guestPhone: normalized }] },
          {
            user: {
              is: {
                phone: normalized,
                provider: false,
              },
            },
          },
        ],
      },
      orderBy: { date: 'desc' },
      take: 50,
      select: {
        id: true,
        userId: true,
        date: true,
        status: true,
        canceledAt: true,
        guestName: true,
        user: { select: { name: true } },
        providerService: {
          select: { name: true, durationMinutes: true, priceCents: true },
        },
        provider: {
          select: {
            id: true,
            name: true,
            avatar: { select: { id: true } },
          },
        },
      },
    });

    const out = rows
      .filter((r): r is typeof r & { provider: NonNullable<typeof r.provider> } => r.provider != null)
      .map(r => ({
        id: r.id,
        date: r.date.toISOString(),
        status: r.status,
        canceled_at: r.canceledAt?.toISOString() ?? null,
        guest_name: r.guestName ?? r.user?.name ?? null,
        associated_to_client: r.userId != null,
        service: r.providerService
          ? {
              name: r.providerService.name,
              duration_minutes: r.providerService.durationMinutes,
              price_cents: r.providerService.priceCents,
            }
          : null,
        provider: {
          id: r.provider.id,
          name: r.provider.name,
          avatar_url: r.provider.avatar
            ? fileUrlForId(r.provider.avatar.id)
            : null,
        },
      }));

    return res.json(out);
  }

  async delete(req: Request, res: Response) {
    const raw = await prisma.appointment.findUnique({
      where: { id: Number(req.params.id) },
      select: {
        id: true,
        date: true,
        userId: true,
        guestName: true,
        guestPhone: true,
        provider: { select: { name: true, email: true } },
        user: { select: { name: true, email: true } },
      },
    });

    if (!raw) {
      return res.status(404).json({ error: 'Marcação não encontrada' });
    }

    if (raw.userId !== req.userId) {
      return res.status(401).json({
        error: 'Sem permissão para cancelar esta marcação.',
      });
    }

    const dateWithSub = subHours(raw.date, 2);

    if (isBefore(dateWithSub, new Date())) {
      return res.status(401).json({
        error: 'Só é possível cancelar com 2 horas de antecedência.',
      });
    }

    const appointment = await prisma.appointment.update({
      where: { id: raw.id },
      data: { canceledAt: new Date(), status: 'canceled', statusUpdatedAt: new Date() },
    });

    await Queue.add(CancellationMail.key, {
      appointment: {
        date: raw.date,
        provider: raw.provider,
        user: raw.user,
        guestName: raw.guestName,
        guestPhone: raw.guestPhone,
      },
    });

    return res.json(appointment);
  }

  async rescheduleSelf(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const schema = z.object({
      date: z.union([z.string().min(1), z.date()]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.issues });
    }

    const raw = await prisma.appointment.findUnique({
      where: { id },
      select: {
        id: true,
        date: true,
        userId: true,
        providerId: true,
        providerServiceId: true,
        guestPhone: true,
        user: { select: { phone: true } },
      },
    });

    if (!raw || !raw.providerId || !raw.providerServiceId) {
      return res.status(404).json({ error: 'Marcação não encontrada' });
    }

    if (raw.userId !== req.userId) {
      return res.status(401).json({ error: 'Sem permissão para remarcar esta marcação.' });
    }

    const dateWithSub = subHours(raw.date, 2);
    if (isBefore(dateWithSub, new Date())) {
      return res.status(401).json({
        error: 'Só é possível remarcar com 2 horas de antecedência.',
      });
    }

    const phoneNormalized = raw.user?.phone ?? raw.guestPhone ?? undefined;

    const v = await this.validateNewBooking({
      providerId: raw.providerId,
      providerServiceId: raw.providerServiceId,
      date: parsed.data.date,
      selfUserId: raw.userId ?? null,
      phoneNormalized,
    });
    if (!v.ok) {
      return res.status(v.status).json({ error: v.error });
    }

    const next = await prisma.appointment.update({
      where: { id: raw.id },
      data: {
        date: v.data.hourStart,
        durationMinutes: v.data.service.durationMinutes,
        providerServiceId: v.data.service.id,
        status: 'scheduled',
        statusUpdatedAt: new Date(),
        canceledAt: null,
      },
    });

    return res.json(next);
  }
}

export default new AppointmentController();
