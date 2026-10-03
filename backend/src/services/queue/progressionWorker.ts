import { Worker, Job } from 'bullmq';
import { getSupabaseClient } from '@/services/supabase/client';
import { logger } from '@/utils/logger';
import {
  advanceCandidate,
  rejectCandidate,
  evaluateStage,
} from '@/services/hiring/progressionService';
import type { ProgressionJobData } from '@/services/queue/progressionQueue';

/**
 * Progression worker (correction #2).
 * Consumes 'hiring-progression' jobs enqueued after atomic result
 * persistence. Calls the CENTRAL progressionService — retries are
 * safe (idempotency row suppresses duplicates).
 */
export async function processProgressionJob(job: Job<ProgressionJobData>): Promise<void> {
  const { candidateId, jobId, recruiterId, fromStage, triggerType, triggerId, passed, recommendation, metadata } = job.data;
  logger.info('[progression-worker] processing', { triggerType, triggerId, fromStage });

  const decision = evaluateStage({ fromStage, passed, recommendation });

  if (!decision.toStage) {
    // Terminal outcome: Rejected / Hold.
    await rejectCandidate({
      candidateId,
      jobId,
      recruiterId,
      fromStage,
      outcome: decision.outcome === 'Hold' ? 'Hold' : 'Rejected',
      triggerType,
      triggerId,
      reason: (metadata as { reason?: string } | undefined)?.reason || String(recommendation || (passed === false ? 'did_not_pass' : 'hold')),
    });
    logger.info('[progression-worker] recorded outcome', { triggerId, outcome: decision.outcome });
    return;
  }

  // Verify recruiter still owns the candidate (cross-recruiter guard).
  const supabase = getSupabaseClient();
  const { data: cand } = await supabase.from('candidates').select('id, recruiter_id').eq('id', candidateId).maybeSingle();
  if (!cand || (cand as { recruiter_id: string }).recruiter_id !== recruiterId) {
    logger.warn('[progression-worker] ownership mismatch — skipping', { candidateId, recruiterId });
    return;
  }

  const result = await advanceCandidate({
    candidateId,
    jobId,
    recruiterId,
    fromStage,
    toStage: decision.toStage,
    triggerType,
    triggerId,
    metadata,
  });
  logger.info('[progression-worker] advanced', { triggerId, toStage: result.toStage, deduplicated: result.deduplicated });
}

export function startProgressionWorker(connection: unknown): Worker {
  const worker = new Worker('hiring-progression', (job) => processProgressionJob(job as Job<ProgressionJobData>), {
    connection: connection as never,
    concurrency: 5,
    lockDuration: 60_000,
  });
  worker.on('failed', (job, err) => {
    logger.error('[progression-worker] job failed', { jobId: job?.id, error: err.message });
  });
  worker.on('completed', (job) => {
    logger.info('[progression-worker] job completed', { jobId: job?.id });
  });
  logger.info('Progression worker listening on queue: hiring-progression');
  return worker;
}
