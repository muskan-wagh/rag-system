import { getResumeQueue } from '@/services/queue';
import { getStuckCandidates, updateCandidate } from '@/services/supabase/database';
import { logger } from '@/utils/logger';

const MAX_RECOVERY_RETRIES = 3;
const IMPOSSIBLE_REASON = 'No resume_file_url — this candidate cannot be reprocessed and has been permanently marked as failed.';

function getRetryCount(errorMessage: string | undefined | null): number {
  if (!errorMessage) return 0;
  const match = errorMessage.match(/recovery_retry=(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export async function runStartupRecovery(): Promise<void> {
  logger.info('Scanning stuck candidates for recovery...');

  const stuck = await getStuckCandidates();

  if (stuck.length === 0) {
    logger.info('No stuck candidates found — recovery skipped');
    return;
  }

  logger.info(`Found ${stuck.length} candidate(s) to evaluate`, {
    statuses: stuck.map(c => `${c.processing_status}${c.error_message ? ` (${c.error_message.slice(0, 60)})` : ''}`),
  });

  const recoverable: typeof stuck = [];
  const impossible: typeof stuck = [];
  const exhausted: typeof stuck = [];

  for (const c of stuck) {
    if (!c.resume_file_url) {
      impossible.push(c);
    } else if (getRetryCount(c.error_message) >= MAX_RECOVERY_RETRIES) {
      exhausted.push(c);
    } else {
      recoverable.push(c);
    }
  }

  // Mark impossible candidates (no file URL) as permanently failed
  for (const c of impossible) {
    logger.warn('Permanently marking candidate as unrecoverable — no file URL', {
      candidateId: c.id,
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

  // Mark candidates that have exhausted recovery retries
  for (const c of exhausted) {
    logger.warn('Candidate exceeded max recovery retries — marking as permanently failed', {
      candidateId: c.id,
      retries: MAX_RECOVERY_RETRIES,
    });
    try {
      await updateCandidate(c.id, {
        processing_status: 'FAILED',
        error_message: `Permanently failed after ${MAX_RECOVERY_RETRIES} recovery retries. Last: ${c.error_message}`,
      });
    } catch (err: any) {
      logger.error('Failed to mark exhausted candidate', {
        candidateId: c.id,
        error: err.message,
      });
    }
  }

  logger.info(
    `Recoverable: ${recoverable.length} — Skipped permanently: ${impossible.length} — Exhausted retries: ${exhausted.length}`,
  );

  if (recoverable.length === 0) {
    logger.info('Recovery completed — no candidates to enqueue');
    return;
  }

  const queue = await getResumeQueue();

  for (const c of recoverable) {
    const retryCount = getRetryCount(c.error_message) + 1;

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

    // Update the error message to track recovery retry count
    await updateCandidate(c.id, {
      error_message: `recovery_retry=${retryCount} — Re-enqueued for reprocessing on startup.`,
    });
  }

  logger.info(`Recovery completed — enqueued ${recoverable.length} candidate(s) for reprocessing`);
}
