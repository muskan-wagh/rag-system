import { Queue } from 'bullmq';
import { ensureRedisConnected } from '@/services/redis/manager';
import { logger } from '@/utils/logger';

/**
 * Progression queue (correction #2).
 * Submit persists score/result FIRST (atomic), then enqueues a
 * progression job. The worker calls progressionService — retries
 * never duplicate interviews/invites/emails (idempotency row).
 */

let progressionQueue: Queue | null = null;

export async function getProgressionQueue(): Promise<Queue> {
  if (!progressionQueue) {
    const connection = await ensureRedisConnected();
    progressionQueue = new Queue('hiring-progression', {
      connection: connection as unknown as never,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 200,
        removeOnFail: 100,
      },
    });
    logger.info('BullMQ progression queue initialized (hiring-progression)');
  }
  return progressionQueue;
}

export interface ProgressionJobData {
  candidateId: string;
  jobId?: string | null;
  recruiterId: string;
  fromStage: string;
  /** Same trigger that keys hiring_progression_events. */
  triggerType: 'assessment_submission' | 'technical_evaluation' | 'hr_evaluation' | 'screening' | 'manual' | 'offer';
  triggerId: string;
  passed?: boolean;
  recommendation?: string;
  metadata?: Record<string, unknown>;
}

/** Stable job id per trigger so double-enqueues collapse to one job. */
export function progressionJobId(triggerType: string, triggerId: string): string {
  return `prog-${triggerType}-${triggerId}`.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 200);
}

export async function enqueueProgressionJob(data: ProgressionJobData): Promise<{ deduplicated: boolean }> {
  try {
    const q = await getProgressionQueue();
    const jobId = progressionJobId(data.triggerType, data.triggerId);
    const existing = await q.getJob(jobId).catch(() => null);
    if (existing) {
      const state = await existing.getState().catch(() => 'unknown');
      if (state === 'active' || state === 'waiting' || state === 'delayed' || state === 'prioritized') {
        return { deduplicated: true };
      }
      await existing.remove().catch(() => {});
    }
    await q.add('progress-candidate', data, { jobId });
    return { deduplicated: false };
  } catch (err) {
    logger.error('Failed to enqueue progression job', { err, triggerId: data.triggerId });
    return { deduplicated: false };
  }
}
