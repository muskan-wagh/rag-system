import { Worker, Job } from 'bullmq';
import { getSupabaseClient } from '@/services/supabase/client';
import { logger } from '@/utils/logger';
import {
  advanceCandidate,
  rejectCandidate,
  evaluateStage,
  isAutoProgressionEnabled,
  parkPassedCandidate,
} from '@/services/hiring/progressionService';
import type { ProgressionJobData } from '@/services/queue/progressionQueue';

/**
 * Close out a progression trigger that will never run. Leaves the trigger in a
 * terminal state so it stops being counted as an in-flight stage.
 */
async function markProgressionEventSkipped(
  triggerType: string,
  triggerId: string,
  reason: string,
): Promise<void> {
  try {
    await getSupabaseClient()
      .from('hiring_progression_events')
      .update({ status: 'skipped', error: reason })
      .eq('trigger_type', triggerType)
      .eq('trigger_id', triggerId)
      .eq('status', 'pending');
  } catch (err) {
    logger.warn('[progression-worker] failed to mark event skipped', {
      triggerType,
      triggerId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Progression worker (correction #2).
 * Consumes 'hiring-progression' jobs enqueued after atomic result
 * persistence. Calls the CENTRAL progressionService — retries are
 * safe (idempotency row suppresses duplicates).
 */
export async function processProgressionJob(job: Job<ProgressionJobData>): Promise<void> {
  const { candidateId, jobId, recruiterId, fromStage, triggerType, triggerId, passed, recommendation, metadata } = job.data;
  logger.info('[progression-worker] processing', { triggerType, triggerId, fromStage });

  // Ownership is verified FIRST, before any write path. Previously the
  // terminal-outcome branch ran ahead of this check, which let a cross-recruiter
  // job reject another recruiter's candidate.
  const supabase = getSupabaseClient();
  const { data: cand } = await supabase
    .from('candidates')
    .select('id, recruiter_id')
    .eq('id', candidateId)
    .maybeSingle();
  if (!cand || (cand as { recruiter_id: string }).recruiter_id !== recruiterId) {
    logger.warn('[progression-worker] ownership mismatch — refusing transition', { candidateId, recruiterId });
    // Mark the trigger resolved-as-skipped rather than returning silently:
    // a silently-returned job reports "completed" while its event stays
    // 'pending' forever, so the hiring summary counted it as a live stage.
    await markProgressionEventSkipped(triggerType, triggerId, 'ownership_mismatch');
    return;
  }

  const decision = evaluateStage({ fromStage, passed, recommendation });

  if (!decision.toStage) {
    const outcome = decision.outcome === 'Hold' ? 'Hold' : 'Rejected';

    // An automated fail (scoring threshold, test execution) must not silently
    // and permanently reject a real candidate. Rejection is a recruiter
    // decision; automation may only park the candidate for review.
    const automatedFail = passed === false;
    if (automatedFail && !(await isAutoProgressionEnabled(jobId, fromStage))) {
      const parked = await parkPassedCandidate({
        candidateId,
        jobId,
        recruiterId,
        fromStage,
        toStage: 'Rejected',
        triggerType,
        triggerId,
      });
      logger.info('[progression-worker] auto-fail parked for recruiter review', {
        triggerId,
        fromStage,
        deduplicated: parked.deduplicated,
      });
      return;
    }

    await rejectCandidate({
      candidateId,
      jobId,
      recruiterId,
      fromStage,
      outcome,
      triggerType,
      triggerId,
      reason: (metadata as { reason?: string } | undefined)?.reason || String(recommendation || (passed === false ? 'did_not_pass' : 'hold')),
    });
    logger.info('[progression-worker] recorded outcome', { triggerId, outcome: decision.outcome });
    return;
  }

  // Recruiter-control gate: park passed candidates when the job disables
  // automatic progression for this transition (no stage change, no email).
  if (decision.toStage && !(await isAutoProgressionEnabled(jobId, fromStage))) {
    const parked = await parkPassedCandidate({
      candidateId,
      jobId,
      recruiterId,
      fromStage,
      toStage: decision.toStage,
      triggerType,
      triggerId,
    });
    logger.info('[progression-worker] parked awaiting recruiter', { triggerId, fromStage, toStage: decision.toStage, deduplicated: parked.deduplicated });
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
