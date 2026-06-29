import express from 'express';
import cors from 'cors';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { requestLogger } from '@/middleware/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { createCollection } from '@/services/qdrant/createCollection';
import routes from '@/routes';

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: reason instanceof Error ? reason.message : reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
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

app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
  logger.info(`Health check: http://localhost:${config.port}/health`);
});

server.timeout = 120000;

async function start(): Promise<void> {
  try {
    await createCollection();
    logger.info('Qdrant collection ready');
  } catch (error) {
    logger.error('Failed to initialize Qdrant collection', { error });
  }
}

start();

export default app;
