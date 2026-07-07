import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSession, createCandidate } from '@/services/supabase/database';
import { getResumeQueue } from '@/services/queue';
import { logger } from '@/utils/logger';

export const uploadResumeHandler = asyncHandler(async (req: Request, res: Response) => {
  const uuid = req.params.uuid as string;
  const source = (req.query.source as string) || '';

  if (!uuid) {
    res.status(400).json({ success: false, error: 'Upload session UUID is required' });
    return;
  }

  logger.info('Upload: fetching session', { uuid });
  const session = await getSession(uuid);
  if (!session) {
    res.status(404).json({ success: false, error: 'Invalid upload link. This session does not exist.' });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, error: 'No file uploaded. Please attach a PDF or DOCX resume.' });
    return;
  }

  const isPdf = file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf');
  const isDocx =
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.originalname.endsWith('.docx');

  if (!isPdf && !isDocx) {
    res.status(400).json({ success: false, error: 'Unsupported file format. Please upload a PDF or DOCX file.' });
    return;
  }

  logger.info('Upload: resume received', {
    sessionId: uuid,
    fileName: file.originalname,
    fileSize: file.size,
    mimeType: file.mimetype,
    source,
  });

  try {
    const candidate = await createCandidate({
      upload_session_id: uuid,
      raw_resume_text: '',
      processing_status: 'PENDING',
      source,
    });
    logger.info('Upload: candidate row created', { candidateId: candidate.id });

    logger.info('Upload: adding job to BullMQ queue...');
    const queue = await getResumeQueue();
    const job = await queue.add('process-resume', {
      sessionId: uuid,
      fileBuffer: Array.from(file.buffer),
      mimeType: file.mimetype,
      originalName: file.originalname,
      source,
      candidateId: candidate.id,
    });
    logger.info('Upload: job added to queue', { candidateId: candidate.id, jobId: job.id });

    res.status(202).json({
      success: true,
      data: {
        message: 'Resume uploaded and queued for processing',
        candidateId: candidate.id,
        jobId: job.id,
      },
    });
  } catch (error: any) {
    logger.error('Upload: failed to queue resume processing', {
      error: error.message,
      stack: error.stack,
      uuid,
      fileName: file.originalname,
    });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process resume. Please try again.',
    });
  }
});
