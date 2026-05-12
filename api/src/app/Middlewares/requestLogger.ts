import type { Request, Response, NextFunction } from 'express';
import { log } from '../../lib/logger.js';

const SKIP_PATHS = new Set<string>(['/api/health']);

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (SKIP_PATHS.has(req.originalUrl)) {
    next();
    return;
  }
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
    log.http(req.method, req.originalUrl, res.statusCode, durationMs);
  });
  next();
}
