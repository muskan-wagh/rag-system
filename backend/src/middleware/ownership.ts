import { Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';

/**
 * Ownership / tenancy enforcement.
 *
 * The recruiter auth middleware establishes *identity* only. Every row that a
 * recruiter can reach must additionally be scoped to `recruiters.id`. Before
 * this module existed, `candidateController` performed no scoping at all, so
 * any authenticated recruiter could read or mutate any other recruiter's
 * candidates by UUID — including PII, private notes, and the ability to hire,
 * reject, or email a stranger's candidate.
 *
 * All helpers deliberately return 404 (not 403) for a row that exists but is
 * owned by someone else, so the API does not become an existence oracle.
 */

/** True when the current recruiter owns this candidate. */
export async function recruiterOwnsCandidate(
  recruiterId: string,
  candidateId: string,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('candidates')
    .select('id')
    .eq('id', candidateId)
    .eq('recruiter_id', recruiterId)
    .maybeSingle();
  if (error) {
    throw new AppError(`Ownership check failed: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  return Boolean(data);
}

/**
 * Express middleware enforcing that `req.params.id` is a candidate owned by
 * the authenticated recruiter. Mount once with `router.use('/:id', ...)`.
 */
export function requireOwnedCandidateMiddleware(req: Request, _res: Response, next: NextFunction): void {
  void (async () => {
    try {
      const recruiterId = req.recruiter?.id as string | undefined;
      if (!recruiterId) {
        next(new AppError('Not authenticated', 401, ErrorCodes.UNAUTHORIZED));
        return;
      }
      const candidateId = String((req.params as Record<string, unknown>).id || '');
      if (!candidateId) {
        next(new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND));
        return;
      }
      const owned = await recruiterOwnsCandidate(recruiterId, candidateId);
      if (!owned) {
        next(new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND));
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  })();
}

/**
 * Filter a list of candidate ids down to the ones this recruiter owns.
 * Used by batch/compare/search style endpoints that receive id arrays.
 */
export async function filterOwnedCandidateIds(
  recruiterId: string,
  candidateIds: string[],
): Promise<string[]> {
  const unique = [...new Set(candidateIds.filter(Boolean))];
  if (unique.length === 0) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('candidates')
    .select('id')
    .eq('recruiter_id', recruiterId)
    .in('id', unique);
  if (error) {
    throw new AppError(`Ownership check failed: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  return ((data || []) as Array<{ id: string }>).map((row) => row.id);
}

/** Narrow candidate ids in place; throws when the caller asked for someone else's. */
export async function assertAllCandidatesOwned(
  recruiterId: string,
  candidateIds: string[],
): Promise<void> {
  const owned = await filterOwnedCandidateIds(recruiterId, candidateIds);
  if (owned.length !== new Set(candidateIds.filter(Boolean)).size) {
    throw new AppError('One or more candidates were not found', 404, ErrorCodes.NOT_FOUND);
  }
}