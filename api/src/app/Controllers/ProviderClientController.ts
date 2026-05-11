import { z } from 'zod';
import type { Request, Response } from 'express';

import { prisma } from '../../lib/prisma.js';
import { fileUrlForPath } from '../../lib/fileUrl.js';
import { normalizePhoneForStorage } from '../../lib/phoneNormalize.js';

class ProviderClientController {
  private async requireProvider(req: Request, res: Response): Promise<boolean> {
    const u = await prisma.user.findFirst({
      where: { id: req.userId, provider: true },
    });
    if (!u) {
      res.status(403).json({ error: 'Apenas profissionais podem gerir clientes.' });
      return false;
    }
    return true;
  }

  async index(req: Request, res: Response) {
    if (!(await this.requireProvider(req, res))) return;

    const [list, clearances] = await Promise.all([
      prisma.client.findMany({
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, email: true, phone: true, createdAt: true },
      }),
      prisma.providerClientClearance.findMany({
        where: { providerId: req.userId! },
        select: { phoneNormalized: true },
      }),
    ]);

    const cleared = new Set(clearances.map(c => c.phoneNormalized));

    return res.json(
      list.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        created_at: c.createdAt.toISOString(),
        has_clearance: !!c.phone && cleared.has(c.phone),
      })),
    );
  }

  async store(req: Request, res: Response) {
    if (!(await this.requireProvider(req, res))) return;

    const schema = z.object({
      name: z.string().min(1).max(200).trim(),
      phone: z.string().min(8).max(32),
      email: z.string().email().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.issues });
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneForStorage(parsed.data.phone);
    } catch {
      return res.status(400).json({ error: 'Telemóvel inválido.' });
    }

    const existing = await prisma.client.findUnique({
      where: { phone: normalizedPhone },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });

    const client = existing
      ? await prisma.client.update({
          where: { id: existing.id },
          data: {
            name: parsed.data.name,
            ...(parsed.data.email ? { email: parsed.data.email.trim() } : {}),
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        })
      : await prisma.client.create({
          data: {
            name: parsed.data.name,
            phone: normalizedPhone,
            email: parsed.data.email?.trim() || null,
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        });

    await prisma.providerClient
      .upsert({
        where: {
          providerId_clientId: {
            providerId: req.userId!,
            clientId: client.id,
          },
        },
        create: {
          providerId: req.userId!,
          clientId: client.id,
        },
        update: {},
      })
      .catch(() => {});

    return res.status(201).json({
      existing: !!existing,
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        created_at: client.createdAt.toISOString(),
      },
    });
  }

  async update(req: Request, res: Response) {
    if (!(await this.requireProvider(req, res))) return;

    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const schema = z.object({
      name: z.string().min(1).max(200).trim().optional(),
      phone: z.string().min(8).max(32).optional(),
      email: z.string().email().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.issues });
    }

    const exists = await prisma.client.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    let normalizedPhone: string | undefined;
    if (parsed.data.phone !== undefined) {
      try {
        normalizedPhone = normalizePhoneForStorage(parsed.data.phone);
      } catch {
        return res.status(400).json({ error: 'Telemóvel inválido.' });
      }

      const phoneTaken = await prisma.client.findFirst({
        where: { phone: normalizedPhone, NOT: { id } },
        select: { id: true },
      });
      if (phoneTaken?.id) {
        return res.status(400).json({ error: 'Este telemóvel já está em uso.' });
      }
    }

    if (parsed.data.email !== undefined) {
      const email = parsed.data.email.trim();
      const taken = await prisma.client.findFirst({
        where: { email, NOT: { id } },
        select: { id: true },
      });
      if (taken) {
        return res.status(400).json({ error: 'Este e-mail já está em uso.' });
      }
    }

    const updated = await prisma.client.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.email !== undefined
          ? { email: parsed.data.email.trim() || null }
          : {}),
        ...(normalizedPhone !== undefined ? { phone: normalizedPhone } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });

    return res.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      created_at: updated.createdAt.toISOString(),
    });
  }

  async appointments(req: Request, res: Response) {
    if (!(await this.requireProvider(req, res))) return;

    const clientId = Number(req.params.id);
    if (Number.isNaN(clientId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const rows = await prisma.appointment.findMany({
      where: {
        clientId,
        providerId: req.userId!,
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        date: true,
        status: true,
        canceledAt: true,
        providerService: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, phone: true } },
        guestName: true,
        guestPhone: true,
      },
      take: 200,
    });

    return res.json(
      rows.map(a => ({
        id: a.id,
        date: a.date.toISOString(),
        status: a.status,
        canceled_at: a.canceledAt?.toISOString() ?? null,
        service: a.providerService
          ? { id: a.providerService.id, name: a.providerService.name }
          : null,
        client: {
          name: a.user?.name ?? a.guestName ?? null,
          phone: a.user?.phone ?? a.guestPhone ?? null,
          is_guest: a.user == null,
        },
      })),
    );
  }

  async timeline(req: Request, res: Response) {
    if (!(await this.requireProvider(req, res))) return;

    const clientId = Number(req.params.id);
    if (Number.isNaN(clientId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, phone: true, email: true, createdAt: true },
    });
    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const rows = await prisma.appointment.findMany({
      where: { clientId, providerId: req.userId! },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        date: true,
        status: true,
        canceledAt: true,
        providerService: { select: { id: true, name: true } },
        record: {
          select: {
            id: true,
            notes: true,
            summary: true,
            recordedAt: true,
            photos: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              select: {
                id: true,
                caption: true,
                sortOrder: true,
                file: { select: { id: true, name: true, path: true } },
              },
            },
          },
        },
      },
      take: 500,
    });

    return res.json({
      client: {
        id: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email,
        created_at: client.createdAt.toISOString(),
      },
      items: rows.map(a => ({
        appointment: {
          id: a.id,
          date: a.date.toISOString(),
          status: a.status,
          canceled_at: a.canceledAt?.toISOString() ?? null,
          service: a.providerService ? { id: a.providerService.id, name: a.providerService.name } : null,
        },
        record: a.record
          ? {
              id: a.record.id,
              recorded_at: a.record.recordedAt.toISOString(),
              summary: a.record.summary ?? null,
              notes: a.record.notes,
              photos: (a.record.photos || []).map(p => ({
                id: p.id,
                sort_order: p.sortOrder,
                caption: p.caption ?? null,
                file: {
                  id: p.file.id,
                  name: p.file.name,
                  path: p.file.path,
                  url: fileUrlForPath(p.file.path),
                },
              })),
            }
          : null,
      })),
    });
  }

  async grantClearance(req: Request, res: Response) {
    if (!(await this.requireProvider(req, res))) return;

    const clientId = Number(req.params.id);
    if (Number.isNaN(clientId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        phone: true,
        account: { select: { userId: true } },
      },
    });
    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    if (!client.phone) {
      return res.status(400).json({ error: 'Cliente sem telemóvel. Adicione um telemóvel para marcar como avaliada.' });
    }

    await prisma.providerClientClearance.upsert({
      where: {
        providerId_phoneNormalized: {
          providerId: req.userId!,
          phoneNormalized: client.phone,
        },
      },
      create: {
        providerId: req.userId!,
        phoneNormalized: client.phone,
        userId: client.account?.userId ?? null,
        grantedAt: new Date(),
      },
      update: {
        userId: client.account?.userId ?? undefined,
        grantedAt: new Date(),
      },
    });

    return res.status(201).json({ ok: true });
  }

  async revokeClearance(req: Request, res: Response) {
    if (!(await this.requireProvider(req, res))) return;

    const clientId = Number(req.params.id);
    if (Number.isNaN(clientId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, phone: true },
    });
    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    if (!client.phone) {
      return res.status(400).json({ error: 'Cliente sem telemóvel.' });
    }

    await prisma.providerClientClearance
      .delete({
        where: {
          providerId_phoneNormalized: {
            providerId: req.userId!,
            phoneNormalized: client.phone,
          },
        },
      })
      .catch(() => {});

    return res.json({ ok: true });
  }
}

export default new ProviderClientController();
