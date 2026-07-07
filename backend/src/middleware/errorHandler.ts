import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { ErrorCodes, ErrorCode } from './errorCodes';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: ErrorCode = ErrorCodes.INTERNAL_ERROR,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    logger.warn(`AppError: ${err.message}`, {
      code: err.code,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });

    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      error: err.message,
      details: err.details,
    });
    return;
  }

  logger.error(`Unhandled error: ${err.message}`, {
    error: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    code: ErrorCodes.INTERNAL_ERROR,
    error: 'Internal server error',
  });
}
