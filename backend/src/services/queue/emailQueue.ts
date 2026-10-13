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
  /**
   * Key of the `email_logs` row written at enqueue time.
   *
   * This field existed on the worker's `EmailJobData` from the start but no
   * call site ever supplied it, so `recordDelivery()` in the worker could never
   * match a row and delivery status stayed 'queued' forever. Every call site
   * that writes an `email_logs` row MUST pass the same key.
   */
  idempotencyKey?: string;
  /**
   * When set, a successful send also marks this `candidate_reports` row as
   * delivered. Without it `candidate_reports.email_status` was pinned at
   * 'queued' even after the report genuinely arrived.
   */
  reportId?: string;
  /**
   * The `assessment_invites` row this email delivers, so the worker can write
   * the REAL outcome into `assessment_invites.delivery_status`. Without it the
   * recruiter UI could only ever show "queued".
   */
  inviteId?: string;
  /** Candidate the invitation belongs to — extra scoping on the invite update. */
  inviteCandidateId?: string;
}

function sanitizeJobId(jobId: string): string {
  return jobId.replace(/[^a-zA-Z0-9-_:.]/g, '').slice(0, 200);
}

export interface EnqueueEmailResult {
  deduplicated: boolean;
  /**
   * False when the job could not be handed to the queue at all.
   *
   * Previously every failure path returned `{ deduplicated: false }`, which is
   * indistinguishable from success — callers logged `status: 'queued'` and
   * returned HTTP 200 for emails that would never be delivered.
   */
  queued: boolean;
  error?: string;
}

export async function enqueueEmail(params: EnqueueEmailParams): Promise<EnqueueEmailResult> {
  try {
    const queue = await getEmailQueue();
    if (params.jobId) {
      const jobId = sanitizeJobId(params.jobId);
      const existing = await queue.getJob(jobId).catch(() => null);
      if (existing) {
        const state = await existing.getState().catch(() => 'unknown');
        if (state === 'active' || state === 'waiting' || state === 'delayed' || state === 'prioritized') {
          return { deduplicated: true, queued: true };
        }
        await existing.remove().catch(() => {});
      }
      const { jobId: _omit, ...payload } = params;
      void _omit;
      await queue.add('send-email', payload, { jobId });
      return { deduplicated: false, queued: true };
    }
    await queue.add('send-email', params);
    return { deduplicated: false, queued: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('Failed to enqueue email', { error, to: params.to, subject: params.subject });
    return { deduplicated: false, queued: false, error };
  }
}
