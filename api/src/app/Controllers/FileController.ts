import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { withFileUrl } from '../../lib/fileUrl.js';

class FileController {
  async download(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).send('Bad request');
    }

    const file = await prisma.file.findUnique({
      where: { id },
      select: { data: true, mimeType: true, name: true },
    });

    if (!file?.data?.length) {
      return res.status(404).send('Not found');
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    );
    return res.send(Buffer.from(file.data));
  }

  async store(req: Request, res: Response) {
    const uploaded = (req as Request & { file?: Express.Multer.File }).file;
    if (!uploaded?.buffer?.length || !uploaded.originalname) {
      return res.status(400).json({ error: 'Envie um ficheiro no campo "file".' });
    }

    const mimeType = uploaded.mimetype || 'application/octet-stream';

    const file = await prisma.file.create({
      data: {
        name: uploaded.originalname,
        mimeType,
        data: new Uint8Array(uploaded.buffer),
      },
    });

    return res.json(withFileUrl(file));
  }
}

export default new FileController();
