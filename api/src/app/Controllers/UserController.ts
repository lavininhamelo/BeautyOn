import { z } from 'zod';
import type { Request, Response } from 'express';

import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../lib/authPassword.js';
import { withFileUrl } from '../../lib/fileUrl.js';
import { normalizePhoneForStorage } from '../../lib/phoneNormalize.js';
import { attachGuestAppointmentsToUser } from '../../lib/linkGuestAppointments.js';

class UserController {
  async profile(req: Request, res: Response) {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        provider: true,
        avatar: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    const avatar = user.avatar ? withFileUrl(user.avatar) : null;

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      provider: user.provider,
      avatar,
    });
  }

  async avatar(req: Request, res: Response) {
    const uploaded = (req as Request & { file?: Express.Multer.File }).file;
    if (!uploaded?.buffer?.length || !uploaded.originalname) {
      return res.status(400).json({ error: 'Envie um ficheiro com o campo "avatar".' });
    }

    const file = await prisma.file.create({
      data: {
        name: uploaded.originalname,
        mimeType: uploaded.mimetype || 'application/octet-stream',
        data: new Uint8Array(uploaded.buffer),
      },
    });

    await prisma.user.update({
      where: { id: req.userId },
      data: { avatarId: file.id },
    });

    const next = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { avatar: true },
    });

    if (!next?.avatar) {
      return res.status(500).json({ error: 'Não foi possível guardar o avatar.' });
    }

    const avatar = withFileUrl(next.avatar);

    return res.json({
      id: next.id,
      name: next.name,
      email: next.email,
      phone: next.phone,
      provider: next.provider,
      avatar,
    });
  }

  async store(req: Request, res: Response) {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      phone: z.string().min(8).max(32),
      provider: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.issues);
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneForStorage(parsed.data.phone);
    } catch {
      return res.status(400).json({ error: 'Telemóvel inválido.' });
    }

    if (parsed.data.provider !== true) {
      const existingClient = await prisma.client.findUnique({
        where: { phone: normalizedPhone },
        select: {
          id: true,
          name: true,
          account: { select: { id: true } },
        },
      });

      if (existingClient && !existingClient.account) {
        return res.status(409).json({
          error:
            'Este telemóvel já está cadastrado como cliente. Conclua o registo para associar a conta.',
          code: 'CLIENT_CLAIM_REQUIRED',
        });
      }
    }

    const userExists = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    if (userExists) {
      return res.status(400).json({ error: 'Este e-mail já está em uso.' });
    }

    const phoneTaken = await prisma.user.findFirst({
      where: { phone: normalizedPhone },
    });
    if (phoneTaken) {
      return res.status(400).json({ error: 'Este telemóvel já está registado.' });
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const { id, name, email, phone, provider } = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: normalizedPhone,
        passwordHash,
        provider: parsed.data.provider === true,
      },
      select: { id: true, name: true, email: true, phone: true, provider: true },
    });

    if (!provider) {
      await attachGuestAppointmentsToUser(id, normalizedPhone);
    }

    return res.json({
      id,
      name,
      email,
      phone,
      provider,
    });
  }

  async update(req: Request, res: Response) {
    const schema = z
      .object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().min(8).max(32).optional(),
        oldPassword: z.string().min(6).optional(),
        password: z.string().min(6).optional(),
        confirmPassword: z.string().optional(),
      })
      .superRefine((data, ctx) => {
        if (data.oldPassword && !data.password) {
          ctx.addIssue({ code: 'custom', path: ['password'], message: 'Obrigatório' });
        }
        if (data.password && data.confirmPassword !== data.password) {
          ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Não coincide com a palavra-passe' });
        }
      });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.issues);
    }

    const { email, oldPassword, phone: phoneRaw } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    if (email && email !== user.email) {
      const userExists = await prisma.user.findFirst({
        where: { email },
      });

      if (userExists) {
        return res.status(400).json({ error: 'Este e-mail já está em uso.' });
      }
    }

    let normalizedPhone: string | undefined;
    if (phoneRaw !== undefined) {
      try {
        normalizedPhone = normalizePhoneForStorage(phoneRaw);
      } catch {
        return res.status(400).json({ error: 'Telemóvel inválido.' });
      }
      if (normalizedPhone !== user.phone) {
        const taken = await prisma.user.findFirst({
          where: { phone: normalizedPhone, NOT: { id: user.id } },
        });
        if (taken) {
          return res.status(400).json({ error: 'Este telemóvel já está em uso.' });
        }
      }
    }

    if (oldPassword && !(await verifyPassword(oldPassword, user.passwordHash))) {
      return res.status(401).json({ error: 'A palavra-passe atual está incorreta.' });
    }

    const { name, password } = parsed.data;
    const updateData: {
      name?: string;
      email?: string;
      phone?: string | null;
      passwordHash?: string;
    } = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (normalizedPhone !== undefined) updateData.phone = normalizedPhone;
    if (password) {
      updateData.passwordHash = await hashPassword(password);
    }
    if (Object.keys(updateData).length) {
      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }

    const updated = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { avatar: true },
    });
    if (!updated) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    const { id, name: outName, email: outEmail, phone, provider } = updated;
    const avatar = updated.avatar ? withFileUrl(updated.avatar) : null;

    if (normalizedPhone !== undefined && !updated.provider) {
      await attachGuestAppointmentsToUser(updated.id, normalizedPhone);
    }

    return res.json({
      id,
      name: outName,
      email: outEmail,
      phone,
      provider,
      avatar,
    });
  }
}

export default new UserController();
