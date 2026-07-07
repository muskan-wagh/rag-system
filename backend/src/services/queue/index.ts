import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';

const REDIS_PLACEHOLDER = 'YOUR_UPSTASH_PASSWORD';
let connection: Redis | null = null;
let queue: Queue | null = null;

function getConnection(): Redis {
  if (!connection) {
    if (config.redis.url.includes(REDIS_PLACEHOLDER)) {
      throw new AppError(
        'Redis URL is not configured. Set REDIS_URL in .env to your Upstash Redis connection string. ' +
        'Get a free instance at https://upstash.com',
        500,
      );
    }

    connection = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 10) {
          logger.error('Redis: max retries exceeded, giving up');
          return null;
        }
        return Math.min(times * 200, 3000);
      },
      lazyConnect: true,
    });

    connection.on('connect', () => logger.info('BullMQ Redis connected'));
    connection.on('ready', () => logger.info('BullMQ Redis ready'));
    connection.on('error', (err) => {
      if (err.message?.includes('ECONNREFUSED') || err.message?.includes('ENOTFOUND')) {
        logger.error('BullMQ Redis connection failed — check REDIS_URL in .env', { error: err.message });
      } else {
        logger.error('BullMQ Redis error', { error: err.message });
      }
    });
    connection.on('close', () => logger.warn('BullMQ Redis connection closed'));
  }
  return connection;
}

export async function getResumeQueue(): Promise<Queue> {
  if (!queue) {
    const conn = getConnection();
    if (conn.status !== 'ready' && conn.status !== 'connecting' && conn.status !== 'connect') {
      logger.info('Redis: attempting connection...');
      try {
        await conn.connect();
      } catch (err: any) {
        logger.error('Redis: connection failed', { error: err.message });
        throw new AppError(
          `Cannot connect to Redis at ${config.redis.url}. Make sure your Upstash Redis instance is running and REDIS_URL is correct.`,
          500,
        );
      }
    }

    queue = new Queue('resume-processing', {
      connection: conn as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
    logger.info('BullMQ queue initialized');
  }
  return queue;
}

export async function getQueueSize(): Promise<number> {
  try {
    const q = await getResumeQueue();
    const counts = await q.getJobCounts('waiting', 'active', 'delayed');
    return (counts.waiting || 0) + (counts.active || 0) + (counts.delayed || 0);
  } catch {
    return 0;
  }
}
