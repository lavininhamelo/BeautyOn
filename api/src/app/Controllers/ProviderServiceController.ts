import { z } from 'zod';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';

const serviceBody = z.object({
  name: z.string().min(1).max(120).trim(),
  duration_minutes: z.coerce
    .number()
    .int()
    .min(5, { message: 'Duração mínima: 5 minutos' })
    .max(480, { message: 'Duração máxima: 480 minutos (8 h)' }),
  price_cents: z.coerce
    .number()
    .int()
    .min(0, { message: 'O preço não pode ser negativo' })
    .max(99_999_999, { message: 'Preço demasiado elevado' })
    .optional(),
  is_evaluation: z.boolean().optional(),
  requires_prior_evaluation: z.boolean().optional(),
});

class ProviderServiceController {
  private async requireProvider(req: Request, res: Response): Promise<boolean> {
    const u = await prisma.user.findFirst({
      where: { id: req.userId, provider: true },
    });
    if (!u) {
      res.status(403).json({ error: 'Apenas profissionais podem gerir serviços.' });
      return false;
    }
    return true;
  }

  async publicIndex(req: Request, res: Response) {
    const providerId = Number(req.params.providerId);
    if (Number.isNaN(providerId)) {
      return res.status(400).json({ error: 'Profissional inválido' });
    }

    const exists = await prisma.user.findFirst({
      where: { id: providerId, provider: true },
      select: { id: true },
    });
    if (!exists) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }

    const list = await prisma.providerService.findMany({
      where: { providerId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        durationMinutes: true,
        isEvaluation: true,
        requiresPriorEvaluation: true,
        priceCents: true,
      },
    });

    return res.json(
      list.map(s => ({
        id: s.id,
        name: s.name,
        duration_minutes: s.durationMinutes,
        price_cents: s.priceCents,
        is_evaluation: s.isEvaluation,
        requires_prior_evaluation: s.requiresPriorEvaluation,
      })),
    );
  }

  async index(req: Request, res: Response) {
    if (!(await this.requireProvider(req, res))) return;

    const list = await prisma.providerService.findMany({
      where: { providerId: req.userId! },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        durationMinutes: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        isEvaluation: true,
        requiresPriorEvaluation: true,
        priceCents: true,
      },
    });

    return res.json(
      list.map(s => ({
        id: s.id,
        name: s.name,
        duration_minutes: s.durationMinutes,
        price_cents: s.priceCents,
        is_evaluation: s.isEvaluation,
        requires_prior_evaluation: s.requiresPriorEvaluation,
        sort_order: s.sortOrder,
        created_at: s.createdAt.toISOString(),
        updated_at: s.updatedAt.toISOString(),
      })),
    );
  }

  async store(req: Request, res: Response) {
    if (!(await this.requireProvider(req, res))) return;

    const parsed = serviceBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.issues });
    }

    const isEvaluation = parsed.data.is_evaluation === true;
    const requiresPriorEvaluation = parsed.data.requires_prior_evaluation === true;
    if (isEvaluation && requiresPriorEvaluation) {
      return res.status(400).json({
        error: 'Dados inválidos',
        issues: [
          {
            code: 'custom',
            path: ['requires_prior_evaluation'],
            message: 'Um serviço de avaliação não pode exigir avaliação prévia.',
          },
        ],
      });
    }

    const maxOrder = await prisma.providerService.aggregate({
      where: { providerId: req.userId! },
      _max: { sortOrder: true },
    });
    const nextOrder = (maxOrder._max.sortOrder ?? 0) + 1;
    const priceCents = parsed.data.price_cents ?? 0;

    const row = await prisma.providerService.create({
      data: {
        providerId: req.userId!,
        name: parsed.data.name,
        durationMinutes: parsed.data.duration_minutes,
        priceCents,
        isEvaluation,
        requiresPriorEvaluation,
        sortOrder: nextOrder,
      },
    });

    return res.status(201).json({
      id: row.id,
      name: row.name,
      duration_minutes: row.durationMinutes,
      price_cents: row.priceCents,
      sort_order: row.sortOrder,
      is_evaluation: row.isEvaluation,
      requires_prior_evaluation: row.requiresPriorEvaluation,
    });
  }

  async update(req: Request, res: Response) {
    if (!(await this.requireProvider(req, res))) return;

    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const parsed = serviceBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.issues });
    }

    const isEvaluation = parsed.data.is_evaluation === true;
    const requiresPriorEvaluation = parsed.data.requires_prior_evaluation === true;
    if (isEvaluation && requiresPriorEvaluation) {
      return res.status(400).json({
        error: 'Dados inválidos',
        issues: [
          {
            code: 'custom',
            path: ['requires_prior_evaluation'],
            message: 'Um serviço de avaliação não pode exigir avaliação prévia.',
          },
        ],
      });
    }

    const existing = await prisma.providerService.findFirst({
      where: { id, providerId: req.userId! },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    const priceCents = parsed.data.price_cents ?? 0;

    const row = await prisma.providerService.update({
      where: { id },
      data: {
        name: parsed.data.name,
        durationMinutes: parsed.data.duration_minutes,
        priceCents,
        isEvaluation,
        requiresPriorEvaluation,
      },
    });

    return res.json({
      id: row.id,
      name: row.name,
      duration_minutes: row.durationMinutes,
      price_cents: row.priceCents,
      sort_order: row.sortOrder,
      is_evaluation: row.isEvaluation,
      requires_prior_evaluation: row.requiresPriorEvaluation,
    });
  }

  async destroy(req: Request, res: Response) {
    if (!(await this.requireProvider(req, res))) return;

    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const existing = await prisma.providerService.findFirst({
      where: { id, providerId: req.userId! },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    await prisma.providerService.delete({ where: { id } });
    return res.status(204).send();
  }
}

export default new ProviderServiceController();
