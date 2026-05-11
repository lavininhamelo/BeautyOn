import { SignJWT } from 'jose';
import { z } from 'zod';
import type { Request, Response } from 'express';

import { prisma } from '../../lib/prisma.js';
import { verifyPassword } from '../../lib/authPassword.js';
import { withFileUrl } from '../../lib/fileUrl.js';
import auth from '../../config/auth.js';

class SessionController {
  async store(req: Request, res: Response) {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.issues);
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findFirst({
      where: { email },
      include: { avatar: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Password does not match' });
    }

    const { id, name, email: userEmail, phone, provider, avatar: avatarRow } = user;
    const avatar = avatarRow ? withFileUrl(avatarRow) : null;

    if (!auth.secret) {
      return res.status(500).json({ error: 'APP_SECRET is not configured' });
    }

    const token = await new SignJWT({ id })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(auth.expiresIn)
      .sign(new TextEncoder().encode(auth.secret));

    return res.json({
      user: {
        id,
        name,
        email: userEmail,
        phone,
        provider,
        avatar,
      },
      token,
    });
  }
}

export default new SessionController();
