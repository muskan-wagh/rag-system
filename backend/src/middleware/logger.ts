import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import crypto from 'crypto';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = crypto.randomUUID().slice(0, 8);
  const start = Date.now();

  (req as Request & { requestId: string }).requestId = requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';

    logger[level](`${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    });
  });

  next();
}
