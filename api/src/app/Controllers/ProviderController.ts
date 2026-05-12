import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { withFileUrl } from '../../lib/fileUrl.js';

class ProviderController {
  async index(req: Request, res: Response) {
    const list = await prisma.user.findMany({
      where: { provider: true },
      select: {
        id: true,
        name: true,
        email: true,
        avatarId: true,
        avatar: { select: { name: true, id: true } },
      },
    });

    return res.json(
      list.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatar_id: u.avatarId,
        avatar: u.avatar ? withFileUrl(u.avatar) : null,
      }))
    );
  }
}

export default new ProviderController();
