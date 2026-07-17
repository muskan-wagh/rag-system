import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSession, createCandidate } from '@/services/supabase/database';
import { uploadResumeFile, getResumeFileUrl, deleteResumeFile } from '@/services/supabase/storage';
import { getResumeQueue } from '@/services/queue';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { broadcast } from '@/services/websocket';

export const uploadResumeHandler = asyncHandler(async (req: Request, res: Response) => {
  const uuid = req.params.id as string;
  const source = (req.query.source as string) || '';
  const file = req.file!;

  logger.info('=== UPLOAD: Step 1/7 — Request received ===', {
    sessionId: uuid,
    fileName: file.originalname,
    fileSize: file.size,
    mimeType: file.mimetype,
    source,
  });

  // Step 2: Validate session exists
  logger.info('UPLOAD: Step 2/7 — Validating upload session', { sessionId: uuid });
  const session = await getSession(uuid);
  if (!session) {
    throw new AppError('Invalid upload link. This session does not exist.', 404, ErrorCodes.NOT_FOUND);
  }
  logger.info('UPLOAD: Session validated', { sessionId: uuid });

  // Step 3: Upload file to Supabase Storage (do this FIRST — before DB insert)
  logger.info('UPLOAD: Step 3/7 — Uploading file to storage', { sessionId: uuid, fileName: file.originalname });
  const storagePath = await uploadResumeFile(uuid, file.originalname, file.buffer, file.mimetype);
  logger.info('UPLOAD: File uploaded to storage', { sessionId: uuid, storagePath });

  // Step 4: Generate public URL
  logger.info('UPLOAD: Step 4/7 — Generating public URL', { storagePath });
  const resumeFileUrl = await getResumeFileUrl(storagePath);
  logger.info('UPLOAD: Public URL generated', { resumeFileUrl });

  // Step 5: Create candidate record in DB (must succeed — or we roll back the storage file)
  logger.info('UPLOAD: Step 5/7 — Creating candidate record', { sessionId: uuid, recruiterId: session.recruiter_id });
  let candidate;
  try {
    candidate = await createCandidate({
      upload_session_id: uuid,
      recruiter_id: session.recruiter_id,
      raw_resume_text: '',
      processing_status: 'PENDING',
      source,
      resume_file_url: resumeFileUrl,
    });
    logger.info('UPLOAD: Candidate record created', { candidateId: candidate.id });
  } catch (dbErr: any) {
    // DB insert failed — roll back the uploaded file to avoid orphan storage objects
    logger.error('UPLOAD: DB insert failed — rolling back storage file', {
      storagePath,
      error: dbErr.message,
    });
    try {
      await deleteResumeFile(storagePath);
      logger.info('UPLOAD: Orphan storage file deleted', { storagePath });
    } catch (cleanupErr: any) {
      logger.error('UPLOAD: Failed to delete orphan storage file — manual cleanup needed', {
        storagePath,
        error: cleanupErr.message,
      });
    }
    throw new AppError('Failed to create candidate record', 500, ErrorCodes.DATABASE_ERROR);
  }

  // Step 6: Enqueue BullMQ job for background processing
  logger.info('UPLOAD: Step 6/7 — Enqueuing BullMQ job', { candidateId: candidate.id });
  try {
    const queue = await getResumeQueue();
    const job = await queue.add('process-resume', {
      sessionId: uuid,
      storagePath,
      mimeType: file.mimetype,
      originalName: file.originalname,
      source,
      candidateId: candidate.id,
    });
    logger.info('UPLOAD: BullMQ job enqueued', { candidateId: candidate.id, jobId: job.id });
  } catch (queueErr: any) {
    // Queue failed — candidate exists but won't be processed. This should be rare.
    logger.error('UPLOAD: Failed to enqueue BullMQ job', {
      candidateId: candidate.id,
      error: queueErr.message,
    });
  }

  // Step 7: Return success to client
  logger.info('=== UPLOAD: Step 7/7 — Returning response ===', { candidateId: candidate.id });
  res.status(202).json({
    success: true,
    data: {
      message: 'Resume uploaded and queued for processing',
      candidateId: candidate.id,
    },
  });

  // Broadcast event (non-blocking, fire-and-forget)
  broadcast('resume:uploaded', { candidateId: candidate.id, sessionId: uuid });
});
