import { Queue } from 'bullmq';
import { ensureRedisConnected } from '@/services/redis/manager';
import { logger } from '@/utils/logger';

let emailQueue: Queue | null = null;

export async function getEmailQueue(): Promise<Queue> {
  if (!emailQueue) {
    const connection = await ensureRedisConnected();

    emailQueue = new Queue('email-sending', {
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

    logger.info('BullMQ email queue initialized (email-sending)');
  }
  return emailQueue;
}

export async function enqueueEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<void> {
  try {
    const queue = await getEmailQueue();
    await queue.add('send-email', params);
  } catch (err) {
    logger.error('Failed to enqueue email', { err, to: params.to, subject: params.subject });
  }
}
