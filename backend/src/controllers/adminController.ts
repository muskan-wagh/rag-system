import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getPendingCandidates } from '@/services/supabase/database';
import { getResumeQueue } from '@/services/queue';
import { logger } from '@/utils/logger';

export const reprocessHandler = asyncHandler(async (_req: Request, res: Response) => {
  const pending = await getPendingCandidates();
  if (pending.length === 0) {
    res.json({ success: true, data: { message: 'No stuck candidates found', reprocessed: 0 } });
    return;
  }

  const queue = await getResumeQueue();
  let enqueued = 0;

  for (const c of pending) {
    if (!c.resume_file_url) {
      logger.warn('Skipping reprocess — no resume_file_url', { candidateId: c.id });
      continue;
    }

    try {
      const fileRes = await fetch(c.resume_file_url);
      if (!fileRes.ok) {
        logger.error('Failed to download stored resume', { candidateId: c.id, status: fileRes.status });
        continue;
      }
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      await queue.add('process-resume', {
        sessionId: c.upload_session_id,
        fileBuffer: Array.from(buffer),
        mimeType: c.resume_file_url.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        originalName: c.resume_file_url.split('/').pop() || 'resume',
        source: c.source || '',
        candidateId: c.id,
      });
      enqueued++;
      logger.info('Reprocess job enqueued', { candidateId: c.id });
    } catch (err: any) {
      logger.error('Failed to reprocess candidate', { candidateId: c.id, error: err.message });
    }
  }

  res.json({
    success: true,
    data: {
      message: `Reprocessed ${enqueued} of ${pending.length} stuck candidates`,
      total: pending.length,
      reprocessed: enqueued,
    },
  });
});
