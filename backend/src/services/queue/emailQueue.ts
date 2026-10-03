import { Queue } from 'bullmq';
import { ensureRedisConnected } from '@/services/redis/manager';
import { logger } from '@/utils/logger';
import type { EmailAttachment } from '@/services/email';

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

export interface EnqueueEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
  attachments?: EmailAttachment[];
  /**
   * Stable BullMQ jobId for idempotent events, e.g.
   * `technical-interview:{id}:{event}:{version}` or
   * `candidate-report:{candidate}:{job}:{version}`.
   * When omitted the job is fire-and-forget (legacy behavior).
   */
  jobId?: string;
}

function sanitizeJobId(jobId: string): string {
  return jobId.replace(/[^a-zA-Z0-9-_:.]/g, '').slice(0, 200);
}

export async function enqueueEmail(params: EnqueueEmailParams): Promise<{ deduplicated: boolean }> {
  try {
    const queue = await getEmailQueue();
    if (params.jobId) {
      const jobId = sanitizeJobId(params.jobId);
      const existing = await queue.getJob(jobId).catch(() => null);
      if (existing) {
        const state = await existing.getState().catch(() => 'unknown');
        if (state === 'active' || state === 'waiting' || state === 'delayed' || state === 'prioritized') {
          return { deduplicated: true };
        }
        await existing.remove().catch(() => {});
      }
      const { jobId: _omit, ...payload } = params;
      void _omit;
      await queue.add('send-email', payload, { jobId });
      return { deduplicated: false };
    }
    await queue.add('send-email', params);
    return { deduplicated: false };
  } catch (err) {
    logger.error('Failed to enqueue email', { err, to: params.to, subject: params.subject });
    return { deduplicated: false };
  }
}
