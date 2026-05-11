import multer from 'multer';
import crypto from 'node:crypto';
import { extname } from 'node:path';
import type { Request } from 'express';

import { tmpUploadsDir } from '../lib/paths.js';

const storage = multer.diskStorage({
  destination: tmpUploadsDir,
  filename: (
    _req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null, filename: string) => void
  ) => {
    crypto.randomBytes(16, (err, buf) => {
      if (err) {
        return callback(err, '');
      }
      return callback(null, buf.toString('hex') + extname(file.originalname));
    });
  },
});

const multerConfig: NonNullable<Parameters<typeof multer>[0]> = { storage };
export default multerConfig;
