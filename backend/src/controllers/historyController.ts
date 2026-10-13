import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { listActivity, ACTION_TYPE_VALUES } from '@/services/activity';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { RecruiterRecord } from '@/services/supabase/database';

/**
 * Validated against the shared constant in `services/activity.ts` rather than a
 * hand-maintained copy. The local list had already drifted and was rejecting the
 * four assessment action types with a 400.
 */
const VALID_ACTION_TYPES: readonly string[] = ACTION_TYPE_VALUES;

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
