import { Queue } from 'bullmq';
import { ensureRedisConnected } from '@/services/redis/manager';
import { logger } from '@/utils/logger';

/**
 * Screening queue — bulk RAG screening without blocking HTTP.
 * POST /jobs/:jobId/screening/run enqueues one job per candidate
 * (stable ids) or a single batch job; the worker reuses the
 * existing embedding/Qdrant/ranking pipeline and persists to
 * screening_results.
 */

let screeningQueue: Queue | null = null;

export async function getScreeningQueue(): Promise<Queue> {
  if (!screeningQueue) {
    const connection = await ensureRedisConnected();
    screeningQueue = new Queue('screening-bulk', {
      connection: connection as unknown as never,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 200,
        removeOnFail: 100,
      },
    });
    logger.info('BullMQ screening queue initialized (screening-bulk)');
  }
  return screeningQueue;
}

export interface ScreeningJobData {
  jobId: string;
  recruiterId: string;
  candidateIds?: string[];
  jdText?: string;
}

export function screeningJobId(jobId: string): string {
  return `screen-${jobId}`.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 200);
}

export async function enqueueScreeningJob(data: ScreeningJobData): Promise<{ jobId: string | undefined; deduplicated: boolean }> {
  const q = await getScreeningQueue();
  const jobId = screeningJobId(data.jobId);
  const existing = await q.getJob(jobId).catch(() => null);
  if (existing) {
    const state = await existing.getState().catch(() => 'unknown');
    // Live job (waiting/active/delayed/prioritized): collapse duplicate.
    if (state === 'active' || state === 'waiting' || state === 'delayed' || state === 'prioritized') {
      logger.info('Screening job already queued — duplicate suppressed', { jobId, state });
      return { jobId: existing.id, deduplicated: true };
    }
    // Terminal stub (completed/failed): allow explicit re-run/retry by
    // removing the stub so a fresh run is enqueued (req 8 + 13).
    await existing.remove().catch(() => {});
  }
  try {
    const added = await q.add('screen-job', data, { jobId });
    return { jobId: added.id, deduplicated: false };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (/already exists|duplicate|JobExists/i.test(message)) {
      logger.info('Screening job raced — duplicate suppressed', { jobId });
      return { jobId, deduplicated: true };
    }
    throw err;
  }
}
