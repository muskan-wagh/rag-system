import { Worker, Job, UnrecoverableError } from 'bullmq';
import { sendEmail } from '@/services/email';
import { logger } from '@/utils/logger';

/**
 * Consumer for the `email-sending` queue (jobs enqueued via `enqueueEmail`).
 * Uses the existing Resend `sendEmail` service — no new provider, no new
 * queue, no Gmail involvement. Started from the existing worker process
 * (see src/worker.ts); delivery retries use the queue's attempts/backoff.
 */

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { to, subject, html, from } = job.data || ({} as EmailJobData);
  if (!to || !subject || !html) {
    throw new UnrecoverableError('Invalid email job payload: to/subject/html required.');
  }
  const result = await sendEmail({ to, subject, html, from });
  if (!result.success) {
    const message = result.error || 'Resend send failed';
    // Config errors will never succeed on retry — fail fast instead of
    // burning the queue's 3 attempts + backoff on every such job.
    if (/not configured/i.test(message)) {
      throw new UnrecoverableError(message);
    }
    throw new Error(message);
  }
  logger.info('EMAIL-WORKER: email sent', { jobId: job.id, to, subject });
}

export function startEmailWorker(connection: unknown): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>('email-sending', processEmailJob, {
    connection: connection as never,
    concurrency: 5,
  });
  worker.on('completed', (job) => {
    logger.info('EMAIL-WORKER: job completed', { jobId: job.id });
  });
  worker.on('failed', (job, err) => {
    logger.error('EMAIL-WORKER: job failed', { jobId: job?.id, error: err.message });
  });
  logger.info('BullMQ email worker started and listening on queue: email-sending');
  return worker;
}
