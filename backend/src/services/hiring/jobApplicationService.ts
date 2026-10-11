import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { isValidTransition } from '@/services/hiring/stageTypes';

/**
 * The candidate↔job relationship — the single source of truth for "who is in
 * this job's pipeline".
 *
 * Before this, membership was inferred by unioning screening results,
 * assessment invites, attempts, interviews and progression events. That made
 * double-counting and cross-job bleed unavoidable, and there was no
 * `UNIQUE(job_id, candidate_id)` to prevent the same person being added twice
 * to one job.
 *
 * `job_applications` (job_id, candidate_id) is now authoritative. The other
 * tables remain evidence, not membership.
 */

export interface JobApplication {
  id: string;
  job_id: string;
  candidate_id: string;
  recruiter_id: string | null;
  /**
   * Persisted as `current_stage` — the live table pre-existed this codebase.
   * Values use the canonical Title-Case lifecycle.
   */
  current_stage: string;
  source: string;
  applied_at: string;
  updated_at: string;
}

export interface EnrollInput {
  jobId: string;
  candidateId: string;
  recruiterId: string;
  source?: string;
  /** Skip the duplicate check (used by backfills/imports). */
  allowDuplicate?: boolean;
}

/**
 * Assert the recruiter owns the job AND the candidate before writing anything.
 * Returns 404 (not 403) so this cannot be used to probe for valid ids.
 */
async function requireOwnedJobAndCandidate(
  recruiterId: string,
  jobId: string,
  candidateId: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const [{ data: job }, { data: candidate }] = await Promise.all([
    supabase.from('jobs').select('id').eq('id', jobId).eq('recruiter_id', recruiterId).maybeSingle(),
    supabase.from('candidates').select('id').eq('id', candidateId).eq('recruiter_id', recruiterId).maybeSingle(),
  ]);
  if (!job) throw new AppError('Job not found', 404, ErrorCodes.NOT_FOUND);
  if (!candidate) throw new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND);
}

/**
 * Enrol a candidate into a job. Idempotent: an existing (job, candidate) pair
 * is returned as-is rather than duplicated.
 */
export async function enrollCandidate(input: EnrollInput): Promise<JobApplication> {
  const supabase = getSupabaseClient();
  await requireOwnedJobAndCandidate(input.recruiterId, input.jobId, input.candidateId);

  const { data, error } = await supabase
    .from('job_applications')
    .upsert(
      {
        job_id: input.jobId,
        candidate_id: input.candidateId,
        recruiter_id: input.recruiterId,
        current_stage: 'Applied',
        source: input.source || 'recruiter_upload',
        applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      // Duplicate application prevention: a candidate can never appear twice
      // in the same job's pipeline.
      { onConflict: 'job_id,candidate_id', ignoreDuplicates: true },
    )
    .select('*')
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to enrol candidate: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  if (!data) {
    // `ignoreDuplicates` returns no row when the pair already existed.
    const { data: existing } = await supabase
      .from('job_applications')
      .select('*')
      .eq('job_id', input.jobId)
      .eq('candidate_id', input.candidateId)
      .maybeSingle();
    if (existing) return existing as JobApplication;
    throw new AppError('Failed to enrol candidate', 500, ErrorCodes.DATABASE_ERROR);
  }
  return data as JobApplication;
}

/** Bulk enrol; returns how many rows were actually created (dedup-safe). */
export async function enrollCandidates(input: {
  jobId: string;
  candidateIds: string[];
  recruiterId: string;
  source?: string;
}): Promise<number> {
  let created = 0;
  for (const candidateId of input.candidateIds) {
    try {
      const before = await getApplication(input.jobId, candidateId);
      await enrollCandidate({
        jobId: input.jobId,
        candidateId,
        recruiterId: input.recruiterId,
        source: input.source,
      });
      if (!before) created += 1;
    } catch (err) {
      // Skip candidates this recruiter does not own rather than aborting the batch.
      if (!(err instanceof AppError)) throw err;
    }
  }
  return created;
}

export async function getApplication(
  jobId: string,
  candidateId: string,
): Promise<JobApplication | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('job_applications')
    .select('*')
    .eq('job_id', jobId)
    .eq('candidate_id', candidateId)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to load application: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  return (data as JobApplication | null) ?? null;
}

/** Every candidate in a job's pipeline, with candidate profile fields. */
export async function listJobPipeline(
  jobId: string,
  recruiterId: string,
  options: { stage?: string; limit?: number; offset?: number } = {},
): Promise<Array<Record<string, unknown>>> {
  const supabase = getSupabaseClient();
  const { data: job } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('recruiter_id', recruiterId)
    .maybeSingle();
  if (!job) throw new AppError('Job not found', 404, ErrorCodes.NOT_FOUND);

  let query = supabase
    .from('job_pipeline')
    .select('*')
    .eq('job_id', jobId)
    .order('applied_at', { ascending: false })
    .range(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 100) - 1);
  // Filter on the VIEW's column name. `job_pipeline` aliases
  // `current_stage AS stage`, so filtering by `current_stage` here would
  // be rejected by PostgREST.
  if (options.stage) query = query.eq('stage', options.stage);

  const { data, error } = await query;
  if (error) {
    throw new AppError(`Failed to load pipeline: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  return (data || []) as Array<Record<string, unknown>>;
}

/**
 * Per-stage counts for a job, straight from the authoritative table.
 * Each candidate contributes to exactly one bucket.
 */
export async function getJobStageCounts(
  jobId: string,
  recruiterId: string,
): Promise<Record<string, number>> {
  const rows = await listJobPipeline(jobId, recruiterId, { limit: 10_000 });
  const counts: Record<string, number> = {};
  for (const row of rows) {
    // The view aliases current_stage -> stage.
    const stage = String(row.stage || row.current_stage || 'Applied');
    counts[stage] = (counts[stage] || 0) + 1;
  }
  return counts;
}

/**
 * Move a candidate's job-scoped stage, enforcing the same transition matrix
 * as the central progression service. Returns false when the transition is
 * not legal so callers can surface a clear error.
 */
export async function setApplicationStage(
  jobId: string,
  candidateId: string,
  toStage: string,
): Promise<{ updated: boolean; reason?: string }> {
  const supabase = getSupabaseClient();
  const existing = await getApplication(jobId, candidateId);
  if (!existing) {
    throw new AppError('Candidate is not in this job', 404, ErrorCodes.NOT_FOUND);
  }
  const fromStage = existing.current_stage;
  if (fromStage === toStage) return { updated: false, reason: 'Already at that stage' };

  const check = isValidTransition(fromStage, toStage);
  if (!check.valid) return { updated: false, reason: check.reason };

  const { error } = await supabase
    .from('job_applications')
    .update({ current_stage: toStage, updated_at: new Date().toISOString() })
    .eq('id', existing.id);
  if (error) {
    throw new AppError(`Failed to update stage: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  return { updated: true };
}

export async function removeApplication(jobId: string, candidateId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('job_applications')
    .delete()
    .eq('job_id', jobId)
    .eq('candidate_id', candidateId);
  if (error) {
    throw new AppError(`Failed to remove application: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
}