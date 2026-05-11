import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { withFileUrl } from '../../lib/fileUrl.js';

class FileController {
  async store(req: Request, res: Response) {
    const { originalname: name, filename: filePath } = (req as any).file as {
      originalname: string;
      filename: string;
    };

    const file = await prisma.file.create({
      data: { name, path: filePath },
    });

    return res.json(withFileUrl(file));
  }
}

export default new FileController();
