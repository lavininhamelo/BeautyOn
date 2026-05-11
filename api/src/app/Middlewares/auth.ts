import { jwtVerify } from 'jose';
import type { Request, Response, NextFunction } from 'express';
import authConfig from '../../config/auth.js';

export default async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token not provided' });
  }

  const [, token] = authHeader.split(' ');

  try {
    if (!authConfig.secret) {
      return res.status(500).json({ error: 'APP_SECRET is not configured' });
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(authConfig.secret));
    const p = payload as { id?: number; pwdReset?: boolean };
    if (p.pwdReset) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.userId = p.id;

    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token not invalid' });
  }
};
