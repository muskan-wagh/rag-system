import { Queue } from 'bullmq';
import { ensureRedisConnected } from '@/services/redis/manager';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';

let queue: Queue | null = null;

export async function getResumeQueue(): Promise<Queue> {
  if (!queue) {
    const connection = await ensureRedisConnected();

    queue = new Queue('resume-processing', {
      connection: connection as any,
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

    logger.info('BullMQ queue initialized (resume-processing)');
  }
  return queue;
}
