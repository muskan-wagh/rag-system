import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { requestLogger } from '@/middleware/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { createCollection } from '@/services/qdrant/createCollection';
import { ensureResumeBucket } from '@/services/supabase/storage';
import routes from '@/routes';

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

app.get('/', (_req, res) => {
  res.json({ service: 'RAG System API', status: 'running', endpoints: { health: '/health', api: '/api' } });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', routes);

app.use((err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ success: false, error: 'File too large. Maximum size is 5MB.' });
      return;
    }
    res.status(400).json({ success: false, error: err.message });
    return;
  }
  if (err.message?.includes('Only PDF and DOCX files are allowed')) {
    res.status(400).json({ success: false, error: err.message });
    return;
  }
  next(err);
});

app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
  logger.info(`Health check: http://localhost:${config.port}/health`);
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
