import { getResumeQueue } from '@/services/queue';
import { getPendingCandidates, updateCandidate } from '@/services/supabase/database';
import { logger } from '@/utils/logger';

const IMPOSSIBLE_REASON = 'No resume_file_url — this candidate cannot be reprocessed and has been permanently marked as failed.';

export async function runStartupRecovery(): Promise<void> {
  logger.info('Scanning recovery candidates...');

  const pending = await getPendingCandidates();

  if (pending.length === 0) {
    logger.info('No stuck candidates found — recovery skipped');
    return;
  }

  logger.info(`Found ${pending.length} candidate(s) to evaluate`, {
    statuses: pending.map(c => c.processing_status),
  });

  const recoverable: typeof pending = [];
  const impossible: typeof pending = [];

  for (const c of pending) {
    if (!c.resume_file_url) {
      impossible.push(c);
    } else {
      recoverable.push(c);
    }
  }

  // Permanently mark impossible candidates so they never appear in startup recovery again
  for (const c of impossible) {
    logger.warn('Permanently marking candidate as unrecoverable', {
      candidateId: c.id,
      reason: IMPOSSIBLE_REASON,
    });
    try {
      await updateCandidate(c.id, {
        processing_status: 'FAILED',
        error_message: IMPOSSIBLE_REASON,
      });
    } catch (err: any) {
      logger.error('Failed to mark candidate as unrecoverable', {
        candidateId: c.id,
        error: err.message,
      });
    }
  }

  logger.info(`Recoverable: ${recoverable.length} — Skipped permanently: ${impossible.length}`);

  if (recoverable.length === 0) {
    logger.info('Recovery completed — no candidates to enqueue');
    return;
  }

  // Enqueue recoverable candidates using the application's queue singleton
  const queue = await getResumeQueue();

  for (const c of recoverable) {
    const urlParts = new URL(c.resume_file_url!).pathname.split('/');
    const storagePath = urlParts.slice(-2).join('/');

    await queue.add('process-resume', {
      sessionId: c.upload_session_id,
      storagePath,
      mimeType: c.resume_file_url!.endsWith('.pdf')
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      originalName: c.resume_file_url!.split('/').pop() || 'resume',
      source: c.source || '',
      candidateId: c.id,
    });
  }

  logger.info(`Recovery completed — enqueued ${recoverable.length} candidate(s) for reprocessing`);
}