import { logger } from '@/utils/logger';

interface QueueJob {
  id: string;
  handler: () => Promise<void>;
}

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;

const queue: QueueJob[] = [];
let processing = false;

export function enqueue(id: string, handler: () => Promise<void>): void {
  queue.push({ id, handler });
  logger.debug(`Job enqueued: ${id} (queue size: ${queue.length})`);
  if (!processing) {
    processQueue();
  }
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  logger.info(`Processing queue: ${queue.length} jobs pending`);

  while (queue.length > 0) {
    const batch = queue.splice(0, BATCH_SIZE);
    logger.info(`Processing batch of ${batch.length} jobs`);

    await Promise.all(
      batch.map(async (job) => {
        try {
          await job.handler();
          logger.debug(`Job completed: ${job.id}`);
        } catch (error) {
          logger.error(`Job failed: ${job.id}`, { error });
        }
      }),
    );

    if (queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  processing = false;
  logger.info('Queue processing complete');
}

export function getQueueSize(): number {
  return queue.length;
}
