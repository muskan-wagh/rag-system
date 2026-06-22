import express from 'express';
import cors from 'cors';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { requestLogger } from '@/middleware/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { createCollection } from '@/services/qdrant/createCollection';
import routes from '@/routes';

const app = express();

app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', routes);

app.use(errorHandler);

async function start(): Promise<void> {
  try {
    await createCollection();
    logger.info('Qdrant collection ready');

    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
      logger.info(`Health check: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

start();

export default app;
