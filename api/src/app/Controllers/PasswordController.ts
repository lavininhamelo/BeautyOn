import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import type { Request, Response } from 'express';

import auth from '../../config/auth.js';
import Mail from '../../lib/Mail.js';
import { prisma } from '../../lib/prisma.js';
import { hashPassword } from '../../lib/authPassword.js';

class PasswordController {
  async forgot(req: Request, res: Response) {
    const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.issues);
    }

    if (!auth.secret) {
      return res.status(500).json({ error: 'APP_SECRET is not configured' });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    const ok = (): Response => res.json({ ok: true });

    if (!user) {
      return ok();
    }

    const token = await new SignJWT({ pwdReset: true })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(String(user.id))
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(auth.secret));

    const base = (
      process.env.CLIENT_PASSWORD_RESET_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:5173'
    ).replace(/\/$/, '');
    const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;

    if (process.env.NODE_ENV !== 'production') {
      console.info('[password/forgot] link dev:', resetUrl);
    }

    try {
      await Mail.sendMail({
        to: user.email,
        subject: 'BeautyOn — recuperação de palavra-passe',
        html: `
          <p>Olá ${user.name},</p>
          <p>Para definires uma nova palavra-passe, usa este link (válido por 1 hora):</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>Se não pediste isto, ignora este email.</p>
        `,
      });
    } catch (err) {
      console.error('password/forgot mail failed', err);
    }

    return ok();
  }

  async reset(req: Request, res: Response) {
    const schema = z
      .object({
        token: z.string().min(10),
        password: z.string().min(6),
        confirmPassword: z.string().min(6),
      })
      .superRefine((data, ctx) => {
        if (data.password !== data.confirmPassword) {
          ctx.addIssue({
            code: 'custom',
            path: ['confirmPassword'],
            message: 'Does not match password',
          });
        }
      });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.issues);
    }

    if (!auth.secret) {
      return res.status(500).json({ error: 'APP_SECRET is not configured' });
    }

    try {
      const { payload } = await jwtVerify(
        parsed.data.token,
        new TextEncoder().encode(auth.secret),
        { algorithms: ['HS256'] },
      );

      if (!payload.pwdReset || typeof payload.sub !== 'string') {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const userId = Number(payload.sub);
      if (!Number.isFinite(userId)) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await hashPassword(parsed.data.password) },
      });

      return res.json({ ok: true });
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }
}

export default new PasswordController();
