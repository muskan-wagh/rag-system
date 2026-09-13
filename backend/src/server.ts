import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { requestLogger } from '@/middleware/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { createCollection } from '@/services/qdrant/createCollection';
import { ensureResumeBucket } from '@/services/supabase/storage';
import { authMiddleware } from '@/middleware/auth';
import { rateLimiter } from '@/middleware/rateLimit';
import { initWebSocketServer } from '@/services/websocket';
import { healthCheck as qdrantHealth } from '@/services/qdrant/client';
import { getSupabaseClient } from '@/services/supabase/client';
import { ensureRedisConnected, setRedisClientOrigin } from '@/services/redis/manager';
import routes from '@/routes';

// Ensure logs directory exists
if (config.nodeEnv === 'production') {
  fs.mkdirSync('logs', { recursive: true });
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: reason instanceof Error ? reason.message : reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
  maxAge: 86400,
}));

app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

// Public routes — must be registered before rateLimiter/auth so that
// Render health checks and browser probes never require a token.
app.get('/', (_req, res) => {
  res.json({ service: 'RAG System API', status: 'running', endpoints: { health: '/health', api: '/api' } });
});

app.get('/health', async (_req, res) => {
  const checks = {
    qdrant: await qdrantHealth(),
    supabase: false,
  };

  try {
    const sb = getSupabaseClient();
    const { data } = await sb.from('upload_sessions').select('id').limit(1);
    checks.supabase = Array.isArray(data);
  } catch {
    checks.supabase = false;
  }

  const healthy = checks.qdrant && checks.supabase;
  res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() });
});

// Protected API — everything under /api requires Clerk auth (except
// explicitly public paths handled inside authMiddleware).
app.use(rateLimiter);
app.use(authMiddleware);
app.use('/api', routes);

app.use((err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ success: false, code: ErrorCodes.VALIDATION_ERROR, error: 'File too large. Maximum size is 5MB.' });
      return;
    }
    res.status(400).json({ success: false, code: ErrorCodes.VALIDATION_ERROR, error: err.message });
    return;
  }
  if (err.message?.includes('Only PDF and DOCX files are allowed')) {
    res.status(400).json({ success: false, code: ErrorCodes.VALIDATION_ERROR, error: err.message });
    return;
  }
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({ success: false, code: ErrorCodes.VALIDATION_ERROR, error: 'Origin not allowed by CORS' });
    return;
  }
  next(err);
});

app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
  initWebSocketServer(server);
});

server.timeout = 120000;
server.headersTimeout = 125000;
server.requestTimeout = 120000;

server.on('connection', (socket) => {
  socket.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'ECONNRESET') {
      logger.warn('Socket ECONNRESET - proxy likely closed connection', {
        remoteAddress: socket.remoteAddress,
        remotePort: socket.remotePort,
      });
    } else {
      logger.warn('Socket error', { code: err.code, message: err.message });
    }
  });

  socket.on('close', (hadError: boolean) => {
    if (hadError) {
      logger.warn('Socket closed with error', {
        remoteAddress: socket.remoteAddress,
        remotePort: socket.remotePort,
      });
    }
  });
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${config.port} is already in use`);
  } else {
    logger.error('Server error', { error: error.message });
  }
  process.exit(1);
});

async function start(): Promise<void> {
  // Connect Redis at API boot so dashboard/RATE-limit cache actually hits.
  // Best-effort: API must stay up even if Redis is unreachable.
  setRedisClientOrigin('api-server');
  try {
    await ensureRedisConnected();
    logger.info('Redis ready (api-server)');
  } catch (error) {
    logger.warn('Redis unavailable at startup — caching disabled until reconnect', { error });
  }

  try {
    await createCollection();
    logger.info('Qdrant collection ready');
  } catch (error) {
    logger.error('Failed to initialize Qdrant collection', { error });
  }

  try {
    await ensureResumeBucket();
    logger.info('Supabase storage ready');
  } catch (error) {
    logger.error('Failed to initialize Supabase storage', { error });
  }
}

start();

export default app;
