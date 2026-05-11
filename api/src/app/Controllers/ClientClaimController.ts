import { createHash } from 'node:crypto';
import { addHours } from 'date-fns/addHours';
import { isBefore } from 'date-fns';
import { z } from 'zod';
import type { Request, Response } from 'express';

import Mail from '../../lib/Mail.js';
import { prisma } from '../../lib/prisma.js';
import { hashPassword } from '../../lib/authPassword.js';
import { attachGuestAppointmentsToUser } from '../../lib/linkGuestAppointments.js';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function generateOtp6(): string {
  const n = Math.floor(Math.random() * 1000000);
  return String(n).padStart(6, '0');
}

class ClientClaimController {
  async request(req: Request, res: Response) {
    const schema = z.object({
      phone: z.string().min(8).max(32),
      email: z.string().email(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.issues });
    }

    const phone = parsed.data.phone;
    const email = parsed.data.email.trim().toLowerCase();

    const client = await prisma.client.findUnique({
      where: { phone },
      select: { id: true, name: true, email: true, account: { select: { id: true } } },
    });

    const eligible = !!client && !client.account;
    if (!eligible) {
      return res.json({ ok: true, eligible: false });
    }

    const code = generateOtp6();
    const tokenHash = sha256(`${phone}:${code}`);
    const expiresAt = addHours(new Date(), 1);

    await prisma.clientClaimToken.create({
      data: {
        tokenHash,
        clientId: client.id,
        email,
        expiresAt,
      },
    });

    try {
      await Mail.sendMail({
        to: email,
        subject: 'BeautyOn — código para concluir registo',
        text: `Olá ${client.name},\n\nO teu código (mock SMS) para concluir o registo é: ${code}\n\nEste código expira em 1 hora.\n\nSe não pediste isto, ignora este email.\n`,
      });
    } catch (err) {
      console.error('client claim mail failed', err);
    }

    const debug = process.env.CLAIM_DEBUG_CODE === 'true';
    return debug
      ? res.json({ ok: true, eligible: true, debug_code: code })
      : res.json({ ok: true, eligible: true });
  }

  async claim(req: Request, res: Response) {
    const schema = z.object({
      phone: z.string().min(8).max(32),
      email: z.string().email(),
      code: z.string().regex(/^\d{6}$/),
      password: z.string().min(6),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.issues });
    }

    const phone = parsed.data.phone;
    const email = parsed.data.email.trim().toLowerCase();
    const tokenHash = sha256(`${phone}:${parsed.data.code}`);
    const row = await prisma.clientClaimToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        usedAt: true,
        expiresAt: true,
        email: true,
        client: { select: { id: true, name: true, phone: true, account: { select: { id: true } } } },
      },
    });

    if (!row || row.usedAt || isBefore(row.expiresAt, new Date())) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    if (row.email !== email) {
      return res.status(401).json({ error: 'Código inválido ou expirado.' });
    }
    if (row.client.phone !== phone) {
      return res.status(401).json({ error: 'Código inválido ou expirado.' });
    }

    if (row.client.account) {
      return res.status(400).json({ error: 'Este cliente já tem conta associada.' });
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({ error: 'Este e-mail já está em uso.' });
    }

    const user = await prisma.user.create({
      data: {
        name: row.client.name,
        email,
        phone: row.client.phone,
        passwordHash: await hashPassword(parsed.data.password),
        provider: false,
      },
      select: { id: true },
    });

    await prisma.clientAccount.create({
      data: {
        clientId: row.client.id,
        userId: user.id,
      },
    });

    await prisma.clientClaimToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });

    const linkedAppointments = await attachGuestAppointmentsToUser(
      user.id,
      row.client.phone,
    );

    return res.json({ ok: true, linked_appointments: linkedAppointments });
  }
}

export default new ClientClaimController();

