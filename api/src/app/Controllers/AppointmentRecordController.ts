import { z } from 'zod';
import type { Request, Response } from 'express';
import multer from 'multer';

import multerConfig from '../../config/multer.js';
import { fileUrlForPath } from '../../lib/fileUrl.js';
import { prisma } from '../../lib/prisma.js';
import { normalizePhoneForStorage } from '../../lib/phoneNormalize.js';

export const recordUpload = multer(multerConfig).array('photos', 10);

class AppointmentRecordController {
  private async requireProvider(req: Request, res: Response): Promise<boolean> {
    const u = await prisma.user.findFirst({
      where: { id: req.userId, provider: true },
      select: { id: true },
    });
    if (!u) {
      res.status(403).json({ error: 'Apenas profissionais podem registar atendimentos.' });
      return false;
    }
    return true;
  }

  async show(req: Request, res: Response) {
    if (!(await this.requireProvider(req, res))) return;

    const appointmentId = Number(req.params.appointmentId);
    if (Number.isNaN(appointmentId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, providerId: req.userId!, canceledAt: null },
      select: { id: true },
    });
    if (!appt) {
      return res.status(404).json({ error: 'Marcação não encontrada' });
    }

    const record = await prisma.appointmentRecord.findUnique({
      where: { appointmentId },
      select: {
        id: true,
        appointmentId: true,
        notes: true,
        summary: true,
        recordedAt: true,
        photos: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            sortOrder: true,
            caption: true,
            file: { select: { id: true, path: true, name: true } },
          },
        },
      },
    });

    if (!record) {
      return res.status(204).send();
    }

    return res.json({
      id: record.id,
      appointment_id: record.appointmentId,
      notes: record.notes,
      summary: record.summary,
      recorded_at: record.recordedAt.toISOString(),
      photos: record.photos.map(p => ({
        id: p.id,
        sort_order: p.sortOrder,
        caption: p.caption,
        file: {
          id: p.file.id,
          name: p.file.name,
          path: p.file.path,
          url: fileUrlForPath(p.file.path),
        },
      })),
    });
  }

  async upsert(req: Request, res: Response) {
    if (!(await this.requireProvider(req, res))) return;

    const appointmentId = Number(req.params.appointmentId);
    if (Number.isNaN(appointmentId)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const schema = z.object({
      notes: z.string().min(1).max(20000),
      summary: z.string().max(400).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.issues });
    }

    const appt = await prisma.appointment.findFirst({
      where: { id: appointmentId, providerId: req.userId!, canceledAt: null },
      select: {
        id: true,
        providerId: true,
        userId: true,
        guestPhone: true,
        user: { select: { phone: true } },
        providerService: { select: { isEvaluation: true } },
      },
    });
    if (!appt) {
      return res.status(404).json({ error: 'Marcação não encontrada' });
    }

    const files = ((req as unknown as { files?: Express.Multer.File[] }).files ??
      []) as Express.Multer.File[];

    const record = await prisma.$transaction(async tx => {
      const upserted = await tx.appointmentRecord.upsert({
        where: { appointmentId },
        create: {
          appointmentId,
          notes: parsed.data.notes,
          summary: parsed.data.summary,
          recordedByProviderId: req.userId!,
        },
        update: {
          notes: parsed.data.notes,
          summary: parsed.data.summary,
          recordedByProviderId: req.userId!,
        },
        select: { id: true },
      });

      if (files.length) {
        const createdFiles = await Promise.all(
          files.map(f =>
            tx.file.create({
              data: { name: f.originalname, path: f.filename },
              select: { id: true },
            }),
          ),
        );

        const maxSort = await tx.appointmentRecordPhoto.aggregate({
          where: { recordId: upserted.id },
          _max: { sortOrder: true },
        });
        let next = (maxSort._max.sortOrder ?? 0) + 1;

        await tx.appointmentRecordPhoto.createMany({
          data: createdFiles.map(cf => ({
            recordId: upserted.id,
            fileId: cf.id,
            sortOrder: next++,
          })),
        });
      }

      if (appt.providerService?.isEvaluation) {
        const rawPhone = appt.user?.phone ?? appt.guestPhone;
        if (rawPhone) {
          let phoneNormalized: string;
          try {
            phoneNormalized = normalizePhoneForStorage(rawPhone);
          } catch {
            phoneNormalized = '';
          }
          if (phoneNormalized) {
            await tx.providerClientClearance.upsert({
              where: {
                providerId_phoneNormalized: {
                  providerId: appt.providerId ?? req.userId!,
                  phoneNormalized,
                },
              },
              create: {
                providerId: appt.providerId ?? req.userId!,
                phoneNormalized,
                userId: appt.userId ?? null,
                sourceAppointmentId: appt.id,
              },
              update: {
                userId: appt.userId ?? undefined,
                sourceAppointmentId: appt.id,
                grantedAt: new Date(),
              },
            });
          }
        }
      }

      return upserted;
    });

    return res.status(201).json({ id: record.id });
  }
}

export default new AppointmentRecordController();

