import { Queue } from 'bullmq';
import { ensureRedisConnected } from '@/services/redis/manager';
import { logger } from '@/utils/logger';

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

export interface ResumeJobData {
  sessionId: string;
  storagePath: string;
  mimeType: string;
  originalName: string;
  source: string;
  candidateId: string;
}

/** Stable job id per candidate so double-submits don't process twice. (No ':' — BullMQ forbids it in custom ids.) */
export function resumeJobId(candidateId: string): string {
  return `resume-${candidateId}`;
}

/**
 * Enqueue a resume job, skipping only if the SAME candidate already has a
 * live (waiting/active/delayed) job. Completed/failed stubs are removed so
 * genuine reprocessing (e.g. startup recovery) is never blocked.
 * Never throws for duplicates — returns { deduplicated: true } instead.
 */
export async function enqueueResumeJob(
  data: ResumeJobData,
): Promise<{ jobId: string | undefined; deduplicated: boolean }> {
  const q = await getResumeQueue();
  const jobId = resumeJobId(data.candidateId);

  const job = await q.getJob(jobId);
  if (job) {
    const state = await job.getState().catch(() => 'unknown');
    if (state === 'active' || state === 'waiting' || state === 'delayed' || state === 'prioritized') {
      logger.info('Resume job already queued — skipping duplicate', {
        candidateId: data.candidateId,
        jobId,
        state,
      });
      return { jobId: job.id, deduplicated: true };
    }
    // Stale stub (completed/failed) — remove so reprocessing can proceed.
    await job.remove().catch(() => {});
  }

  // NOTE: concurrent double-submits can both pass the getJob check above.
  // Redis keeps a single job per id; the loser's add returns the winner's
  // (older) job record. The timestamp comparison detects that so callers
  // get an honest deduplicated flag. Either way there is exactly ONE
  // processable job — the upload is never dropped and never doubled.
  const startedAt = Date.now();
  try {
    const added = await q.add('process-resume', data, { jobId });
    const deduplicated =
      typeof added.timestamp === 'number' && added.timestamp < startedAt;
    if (deduplicated) {
      logger.info('Resume job raced — duplicate suppressed', {
        candidateId: data.candidateId,
        jobId,
      });
    }
    return { jobId: added.id, deduplicated };
  } catch (err: any) {
    if (/already exists|duplicate|JobExists/i.test(err.message || '')) {
      logger.info('Resume job raced — duplicate suppressed', {
        candidateId: data.candidateId,
        jobId,
      });
      return { jobId, deduplicated: true };
    }
    throw err;
  }
}
