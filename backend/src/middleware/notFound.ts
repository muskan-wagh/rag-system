import { Request, Response, NextFunction } from 'express';
import { ErrorCodes } from './errorCodes';

/**
 * JSON 404 handlers.
 *
 * Express's built-in response for an unmatched route is an HTML page
 * ("Cannot GET /api/…"). A browser client that blindly calls `res.json()` on
 * that throws `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`, which
 * the UI cannot recover from — it shows an opaque error and often leaves the
 * screen on a loading skeleton forever.
 *
 * These handlers keep the API contract intact: every unmatched path answers
 * with a structured JSON error, so a client can tell "this route is not
 * deployed on the running backend build" apart from "your request failed".
 *
 * They are mounted AFTER the error handlers in `server.ts`, so an exception
 * raised inside routing is still classified as an error rather than being
 * swallowed as "not found".
 */

export function apiNotFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    code: ErrorCodes.NOT_FOUND,
    error:
      `No API route matches ${req.method} ${req.baseUrl}${req.path}. ` +
      'This endpoint may not be deployed on the running backend build.',
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ success: false, code: ErrorCodes.NOT_FOUND, error: 'Not found' });
}

/**
 * Last-resort guard: if anything ever escapes as a non-JSON response, rewrite
 * it to JSON. Registered with four arguments so Express treats it as an error
 * handler.
 */
export function jsonFallbackErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(500).json({
    success: false,
    code: ErrorCodes.INTERNAL_ERROR,
    error: 'Internal server error',
  });
}