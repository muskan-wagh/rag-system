import { Worker, Job, UnrecoverableError } from 'bullmq';
import { getSupabaseClient } from '@/services/supabase/client';
import { logger } from '@/utils/logger';
import { runScreeningForCandidate } from '@/controllers/screeningController';
import type { ScreeningJobData } from '@/services/queue/screeningQueue';

/**
 * Bulk screening worker — reuses the existing RAG pipeline per
 * candidate and persists to screening_results. Never blocks HTTP.
 */
export async function processScreeningJob(job: Job<ScreeningJobData>): Promise<void> {
  const { jobId, recruiterId, candidateIds, jdText } = job.data;
  const supabase = getSupabaseClient();

  const { data: jobRow } = await supabase.from('jobs').select('id, recruiter_id, description, title').eq('id', jobId).maybeSingle();
  if (!jobRow || (jobRow as { recruiter_id: string }).recruiter_id !== recruiterId) {
    throw new UnrecoverableError('Job not found or not owned');
  }
  const jd = String(jdText || (jobRow as { description?: string }).description || (jobRow as { title?: string }).title || '');
  if (!jd.trim()) throw new UnrecoverableError('No JD text available');

  let ids = candidateIds || [];
  if (ids.length === 0) {
    // Default: recruiter's recent candidates (bounded).
    const { data: cands } = await supabase
      .from('candidates')
      .select('id')
      .eq('recruiter_id', recruiterId)
      .order('created_at', { ascending: false })
      .limit(50);
    ids = ((cands || []) as Array<{ id: string }>).map((c) => c.id);
  }

  logger.info('[screening-worker] bulk screening started', { jobId, count: ids.length });
  for (const candidateId of ids.slice(0, 200)) {
    try {
      await runScreeningForCandidate(jobId, candidateId, jd);
    } catch (err) {
      logger.warn('[screening-worker] candidate failed (continuing)', {
        candidateId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  logger.info('[screening-worker] bulk screening done', { jobId });
}

export function startScreeningWorker(connection: unknown): Worker {
  const worker = new Worker('screening-bulk', (job) => processScreeningJob(job as Job<ScreeningJobData>), {
    connection: connection as never,
    concurrency: 2,
    lockDuration: 120_000,
  });
  worker.on('failed', (job, err) => {
    logger.error('[screening-worker] job failed', { jobId: job?.id, error: err.message });
  });
  logger.info('Screening worker listening on queue: screening-bulk');
  return worker;
}
