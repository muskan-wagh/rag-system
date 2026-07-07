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
}));

app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);
app.use(rateLimiter);
app.use(authMiddleware);

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
  next(err);
});

app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
  initWebSocketServer(server);
});

server.timeout = 120000;

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${config.port} is already in use`);
  } else {
    logger.error('Server error', { error: error.message });
  }
  process.exit(1);
});

async function start(): Promise<void> {
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
