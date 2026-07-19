import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { listActivity } from '@/services/activity';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { RecruiterRecord } from '@/services/supabase/database';

const VALID_ACTION_TYPES = [
  'resume_uploaded', 'resume_processed', 'search_executed', 'candidate_viewed',
  'candidate_compared', 'status_changed', 'interview_scheduled', 'email_sent',
  'offer_generated', 'note_added', 'saved_search_created', 'talent_pool_created',
  'candidate_added_to_pool',
];

export const getHistoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter as RecruiterRecord;
  if (!recruiter) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;
  const actionType = req.query.actionType as string | undefined;
  const search = req.query.search as string | undefined;

  if (actionType && !VALID_ACTION_TYPES.includes(actionType)) {
    throw new AppError(`Invalid action type. Valid: ${VALID_ACTION_TYPES.join(', ')}`, 400, ErrorCodes.VALIDATION_ERROR);
  }

  const result = await listActivity({
    recruiterId: recruiter.id,
    limit,
    offset,
    actionType,
    search,
  });

  res.status(200).json({
    success: true,
    data: {
      entries: result.entries,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    },
  });
});
