import { Request, Response, NextFunction } from 'express';
import { config } from '@/config';

// These paths are accessible WITHOUT authentication.
// Paths are matched against req.path (which is the full path at the app level).
const PUBLIC_PATHS = ['/api/upload', '/api/generate-link', '/api/sessions'];

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!config.apiKey) {
    return next();
  }

  if (PUBLIC_PATHS.some((path) => req.path === path || req.path.startsWith(path + '/'))) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  if (token !== config.apiKey) {
    res.status(403).json({ success: false, error: 'Invalid API key' });
    return;
  }

  next();
}
