import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { requireOwnedAttempt } from '@/middleware/candidateAuth';

/**
 * Proctoring event foundation — observable signals only.
 * Never claims cheating. Stored for future AI-assisted review.
 * Camera/mic use browser APIs; no third-party, no recording.
 */

const ALLOWED = new Set([
  'TAB_SWITCH',
  'FULLSCREEN_EXIT',
  'COPY',
  'PASTE',
  'CAMERA_DISABLED',
  'MIC_DISABLED',
  'NETWORK_DISCONNECTED',
  'NETWORK_RECONNECTED',
]);

// Candidate: POST /candidate/attempts/:attemptId/proctoring
export const logProctoringHandler = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.candidate;
  if (!ctx) throw new AppError('Candidate session required', 401, ErrorCodes.NOT_FOUND);
  const attemptId = String((req.params as Record<string, unknown>).attemptId || "");
  const { eventType, metadata } = req.body || {};
  if (!ALLOWED.has(String(eventType))) {
    throw new AppError('Invalid eventType', 400, ErrorCodes.VALIDATION_ERROR);
  }
  const attempt = await requireOwnedAttempt(ctx.candidateId, attemptId, ctx.assessmentId);
  if (attempt.status !== 'in_progress') {
    throw new AppError('Attempt is no longer active', 409, ErrorCodes.VALIDATION_ERROR);
  }
  const supabase = getSupabaseClient();
  const safeMeta =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? Object.fromEntries(Object.entries(metadata as Record<string, unknown>).slice(0, 10))
      : {};
  const { error } = await supabase.from('proctoring_events').insert({
    attempt_id: attemptId,
    candidate_id: ctx.candidateId,
    event_type: String(eventType),
    metadata: safeMeta,
  });
  if (error) throw new AppError(`Failed to log event: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  res.json({ success: true, data: { logged: true } });
});

// Recruiter: GET /assessments/attempts/:attemptId/proctoring
export const listProctoringHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const attemptId = String((req.params as Record<string, unknown>).attemptId || "");
  const supabase = getSupabaseClient();
  const { data: attempt } = await supabase
    .from('assessment_attempts')
    .select('id, assessment_id, candidate_id')
    .eq('id', attemptId)
    .maybeSingle();
  if (!attempt) throw new AppError('Attempt not found', 404, ErrorCodes.NOT_FOUND);
  const { data: assessment } = await supabase
    .from('assessments')
    .select('id, recruiter_id')
    .eq('id', (attempt as { assessment_id: string }).assessment_id)
    .maybeSingle();
  if (!assessment || (assessment as { recruiter_id: string }).recruiter_id !== recruiter.id) {
    throw new AppError('Attempt not found', 404, ErrorCodes.NOT_FOUND);
  }
  const { data: events } = await supabase
    .from('proctoring_events')
    .select('event_type, created_at, metadata')
    .eq('attempt_id', attemptId)
    .order('created_at', { ascending: true })
    .limit(500);
  res.json({ success: true, data: events || [] });
});
