import { Worker, Job, UnrecoverableError } from 'bullmq';
import { sendEmail, type EmailAttachment } from '@/services/email';
import { getSupabaseClient } from '@/services/supabase/client';
import { logger } from '@/utils/logger';

/**
 * Consumer for the `email-sending` queue (jobs enqueued via `enqueueEmail`).
 * Uses the existing Resend `sendEmail` service — no new provider, no new
 * queue, no Gmail involvement. Started from the existing worker process
 * (see src/worker.ts); delivery retries use the queue's attempts/backoff.
 * Supports PDF attachments (candidate-safe reports). Internal reports are
 * never attached — enforced by callers + report service.
 */

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  from?: string;
  attachments?: EmailAttachment[];
  /**
   * Idempotency key of the `email_logs` row written at enqueue time. Lets the
   * worker record the real delivery outcome against the same row, so the UI
   * can distinguish "queued" from "delivered".
   */
  idempotencyKey?: string;
  /** Marks a `candidate_reports` row delivered when this email is its report. */
  reportId?: string;
}

async function recordDelivery(
  data: EmailJobData,
  status: 'sent' | 'failed',
  providerMessageId?: string,
): Promise<void> {
  const supabase = getSupabaseClient();

  if (data.idempotencyKey) {
    const patch: Record<string, unknown> = {
      status,
      error: status === 'failed' ? 'Delivery failed' : null,
    };
    if (status === 'sent') patch.sent_at = new Date().toISOString();
    if (providerMessageId) patch.gmail_message_id = providerMessageId;
    await supabase
      .from('email_logs')
      .update(patch)
      .eq('idempotency_key', data.idempotencyKey)
      .eq('status', 'queued');
  }

  if (data.reportId && status === 'sent') {
    await supabase
      .from('candidate_reports')
      .update({ email_status: 'sent', email_sent_at: new Date().toISOString(), email_error: null })
      .eq('id', data.reportId);
  }
}

export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const data = job.data || ({} as EmailJobData);
  const { to, subject, html, from, attachments } = data;
  if (!to || !subject || !html) {
    throw new UnrecoverableError('Invalid email job payload: to/subject/html required.');
  }
  if (attachments) {
    for (const a of attachments) {
      if (!a.filename || !a.content) {
        throw new UnrecoverableError('Invalid email attachment: filename/content required.');
      }
      // ~7MB cap on decoded attachments — reports are normally < 1MB.
      if (a.content.length > 9_500_000) {
        throw new UnrecoverableError('Email attachment too large.');
      }
    }
  }

  let result;
  try {
    result = await sendEmail({ to, subject, html, from, attachments });
  } catch (err) {
    await recordDelivery(data, 'failed').catch(() => undefined);
    throw err;
  }

  if (!result.success) {
    const message = result.error || 'Resend send failed';
    // Config errors will never succeed on retry — fail fast instead of
    // burning the queue's 3 attempts + backoff on every such job.
    if (/not configured/i.test(message)) {
      await recordDelivery(data, 'failed').catch(() => undefined);
      throw new UnrecoverableError(message);
    }
    await recordDelivery(data, 'failed').catch(() => undefined);
    throw new Error(message);
  }

  await recordDelivery(data, 'sent', (result as { id?: string }).id).catch(() => undefined);
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
