import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';

class NotificationController {
  async index(req: Request, res: Response) {
    const isProvider = await prisma.user.findFirst({
      where: { id: req.userId, provider: true },
    });

    if (!isProvider) {
      return res.status(401).json({ error: 'Only providers can load notifications' });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return res.json(notifications);
  }

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid notification id' });
    }

    const existing = await prisma.notification.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    return res.json(notification);
  }
}

export default new NotificationController();
