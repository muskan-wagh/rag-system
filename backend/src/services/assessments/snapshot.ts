import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';

/**
 * Immutable assessment snapshots.
 *
 * ── The defect this fixes ─────────────────────────────────────────────────────
 * Scoring read questions straight off the live `assessment_questions` table at
 * submit time. Combined with the fact that a published assessment could be
 * unpublished, edited, and republished, that meant an issued invitation link
 * could mean two entirely different assessments at two different moments in
 * time: candidate A who opened the link on Monday was graded against question
 * set 1, candidate B who opened it on Thursday was graded against question set
 * 2, both from the same URL. Scores were not comparable and none of the stored
 * data could prove otherwise.
 *
 * ── The model ─────────────────────────────────────────────────────────────────
 * `publishAssessmentHandler` freezes the full question set — including every
 * grading-critical field — into `assessments.published_snapshot` and bumps
 * `snapshot_version` in the SAME conditional write. Invites and attempts carry
 * the version they were issued against. Grading resolves questions from the
 * snapshot, never from the live table.
 *
 * ── Legacy attempts ───────────────────────────────────────────────────────────
 * Attempts created before snapshotting have `snapshot_source = 'live'` and a NULL
 * `snapshot_version`. Their original question set is not recoverable, so they
 * keep scoring against the live table exactly as before and reports say so
 * explicitly. Inventing a snapshot for them would be a fabrication.
 */

export interface RawQuestion {
  id: string;
  assessment_id: string;
  type: string;
  position: number;
  title: string;
  prompt: string;
  payload: Record<string, unknown>;
  marks: number;
  skill_tag: string;
  is_required: boolean;
}

export interface AssessmentSnapshotQuestion {
  id: string;
  type: string;
  position: number;
  title: string;
  prompt: string;
  /** Full payload INCLUDING answer keys. Server-side only — never serialized to a candidate. */
  payload: Record<string, unknown>;
  marks: number;
  skill_tag: string;
  is_required: boolean;
}

export interface AssessmentSnapshot {
  version: number;
  assessment_id: string;
  name: string;
  duration_minutes: number;
  passing_score: number;
  settings: Record<string, unknown>;
  /** Exact ISO instant the snapshot was taken. */
  published_at: string;
  total_marks: number;
  questions: AssessmentSnapshotQuestion[];
}

export type SnapshotSource = 'snapshot' | 'live';

export interface ResolvedQuestions {
  questions: RawQuestion[];
  version: number | null;
  source: SnapshotSource;
  /**
   * Present only when `source === 'live'` on a pre-migration attempt. Carries a
   * user-facing sentence explaining that reproducibility is not guaranteed for
   * this historical record. Never set for a new attempt.
   */
  limitation?: string;
}

export interface SnapshotCapableAssessment {
  id: string;
  recruiter_id: string;
  job_id: string | null;
  name: string;
  duration_minutes: number;
  passing_score: number;
  settings: Record<string, unknown> | null;
  status: string;
  snapshot_version?: number | null;
  published_snapshot?: AssessmentSnapshot | null;
}

/** Structural validation. A snapshot that fails this is treated as absent. */
export function isValidSnapshot(value: unknown): value is AssessmentSnapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<AssessmentSnapshot>;
  if (typeof s.version !== 'number' || s.version < 1) return false;
  if (typeof s.assessment_id !== 'string' || !s.assessment_id) return false;
  if (!Array.isArray(s.questions) || s.questions.length === 0) return false;
  return s.questions.every((q) => {
    if (!q || typeof q !== 'object') return false;
    const question = q as Partial<AssessmentSnapshotQuestion>;
    return (
      typeof question.id === 'string' &&
      !!question.id &&
      typeof question.type === 'string' &&
      typeof question.prompt === 'string' &&
      typeof question.marks === 'number' &&
      !!question.payload &&
      typeof question.payload === 'object'
    );
  });
}

/**
 * Build the snapshot payload from the live question rows.
 *
 * Deliberately carries the COMPLETE payload — correct option, hidden test cases
 * with their expected output, expected query/result, rubric. That is exactly
 * the data grading needs and exactly the data that must never reach a candidate;
 * `sanitizeQuestions` is applied on the candidate-facing path and nowhere is this
 * structure serialized to the browser.
 */
export function buildSnapshot(input: {
  assessment: SnapshotCapableAssessment;
  questions: RawQuestion[];
  nextVersion: number;
}): AssessmentSnapshot {
  const ordered = [...input.questions].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return {
    version: input.nextVersion,
    assessment_id: input.assessment.id,
    name: input.assessment.name,
    duration_minutes: input.assessment.duration_minutes,
    passing_score: input.assessment.passing_score,
    settings: (input.assessment.settings as Record<string, unknown> | null) ?? {},
    published_at: new Date().toISOString(),
    total_marks: ordered.reduce((sum, q) => sum + (Number(q.marks) || 0), 0),
    questions: ordered.map((q) => ({
      id: q.id,
      type: q.type,
      position: q.position ?? 0,
      title: q.title ?? '',
      prompt: q.prompt,
      payload: q.payload ?? {},
      marks: Number(q.marks) || 0,
      skill_tag: q.skill_tag ?? '',
      is_required: q.is_required ?? true,
    })),
  };
}

/**
 * Persist the snapshot and bump the version in ONE conditional write.
 *
 * Conditional on the version we read. Two recruiters clicking Publish at the
 * same instant both read version 3; the first write lands (version becomes 4),
 * the second matches zero rows and is reported as a conflict rather than
 * silently overwriting — otherwise the two snapshots would share a version and
 * every invite pointing at v4 would be ambiguous.
 */
export async function persistSnapshot(input: {
  assessmentId: string;
  recruiterId: string;
  previousVersion: number;
  snapshot: AssessmentSnapshot;
}): Promise<{ version: number }> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('assessments')
    .update({
      status: 'published',
      published_snapshot: input.snapshot,
      snapshot_version: input.snapshot.version,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.assessmentId)
    .eq('recruiter_id', input.recruiterId)
    .eq('snapshot_version', input.previousVersion)
    .select('snapshot_version')
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to publish assessment: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }

  if (!data) {
    throw new AppError(
      'This assessment was published by another action a moment ago. Reload to see the current version.',
      409,
      ErrorCodes.CONFLICT,
    );
  }

  const version = (data as { snapshot_version?: number }).snapshot_version ?? input.snapshot.version;

  // Append the immutable history row. `assessments.published_snapshot` only ever
  // holds the LATEST version; without history a candidate holding a v1 link
  // would lose their question set the moment a recruiter republished.
  //
  // `ON CONFLICT DO NOTHING` — a retried publish of the same version is a no-op,
  // not a corruption. The history row is append-only by design.
  const { error: historyError } = await supabase.from('assessment_snapshots').upsert(
    {
      assessment_id: input.assessmentId,
      version,
      snapshot: input.snapshot,
      published_at: input.snapshot.published_at,
      published_by: input.recruiterId,
    },
    { onConflict: 'assessment_id,version', ignoreDuplicates: true },
  );

  if (historyError) {
    // The publish itself succeeded; the history write did not. That leaves
    // earlier versions ungradeable, so it must be surfaced rather than logged
    // and forgotten.
    throw new AppError(
      `Assessment published as version ${version}, but its version history could not be written (${historyError.message}). Earlier versions may become ungradeable — retry the publish.`,
      500,
      ErrorCodes.DATABASE_ERROR,
    );
  }

  return { version };
}

/**
 * Resolve the question set an attempt must be graded against.
 *
 * `pinnedSnapshot` is the row from `assessment_snapshots` for the attempt's
 * version. It comes from the version history rather than
 * `assessments.published_snapshot`, because the latter only ever holds the
 * LATEST version — after a republish it would no longer describe an attempt
 * issued against v1, and grading from it would either fail or silently regrade
 * the candidate against questions they never saw.
 *
 * Rules, in priority order:
 *
 *  1. `snapshot_source === 'snapshot'` with a VALID pinned snapshot → grade
 *     against it. This is the only path a new attempt takes.
 *  2. `snapshot_source === 'snapshot'` but the snapshot is missing or corrupt →
 *     **throw**. Silently falling back to live questions would mean grading a
 *     candidate against material they never saw, which is far worse than
 *     refusing to score.
 *  3. `snapshot_source === 'live'` (pre-migration attempt) → grade against the
 *     live rows and attach a `limitation` string for the report.
 */
export function resolveQuestionsForAttempt(
  attempt: { snapshot_source?: string | null; snapshot_version?: number | null },
  assessment: SnapshotCapableAssessment,
  liveQuestions: RawQuestion[],
  pinnedSnapshot?: unknown,
): ResolvedQuestions {
  const source = (attempt.snapshot_source ?? 'live') as SnapshotSource;

  if (source === 'snapshot') {
    const version = attempt.snapshot_version ?? null;
    if (version == null) {
      throw new AppError(
        'This attempt is pinned to an assessment snapshot but no version was recorded. The result cannot be graded reliably.',
        500,
        ErrorCodes.DATABASE_ERROR,
      );
    }

    // Prefer the version history. Fall back to the assessment's own
    // `published_snapshot` only when it IS that version (i.e. no republish has
    // happened since), so the two paths can never disagree.
    const candidate =
      isValidSnapshot(pinnedSnapshot)
        ? pinnedSnapshot
        : isValidSnapshot(assessment.published_snapshot) &&
            assessment.published_snapshot.version === version
          ? assessment.published_snapshot
          : null;

    if (!candidate) {
      throw new AppError(
        `Assessment version ${version} cannot be loaded, so this attempt cannot be graded. Contact support — grading against the live question set would score the candidate against something they never saw.`,
        500,
        ErrorCodes.DATABASE_ERROR,
        { snapshotVersion: version },
      );
    }
    if (candidate.version !== version) {
      throw new AppError(
        `Attempt is pinned to version ${version} but the stored snapshot is version ${candidate.version}. Refusing to grade against a mismatched question set.`,
        500,
        ErrorCodes.DATABASE_ERROR,
        { expected: version, actual: candidate.version },
      );
    }
    return {
      questions: candidate.questions as RawQuestion[],
      version,
      source: 'snapshot',
    };
  }

  return {
    questions: liveQuestions,
    version: attempt.snapshot_version ?? null,
    source: 'live',
    limitation:
      'This attempt predates assessment snapshotting. Its question set is not recoverable, so the result is reported exactly as it was originally scored and is not guaranteed to be reproducible.',
  };
}

/**
 * Load the pinned snapshot row for one assessment version from the immutable
 * history table.
 *
 * Returns `null` when there is no such version — which is a hard failure for any
 * attempt pinned to it, and a caller-visible signal rather than a fallback.
 */
export async function loadPinnedSnapshot(
  assessmentId: string,
  version: number | null,
): Promise<AssessmentSnapshot | null> {
  if (version == null) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assessment_snapshots')
    .select('snapshot')
    .eq('assessment_id', assessmentId)
    .eq('version', version)
    .maybeSingle();
  if (error) {
    throw new AppError(
      `Failed to load assessment version ${version}: ${error.message}`,
      500,
      ErrorCodes.DATABASE_ERROR,
    );
  }
  const snapshot = (data as { snapshot?: unknown } | null)?.snapshot ?? null;
  return isValidSnapshot(snapshot) ? snapshot : null;
}

/**
 * Aggregate skill-wise strengths and gaps from REAL persisted answer data.
 *
 * Only counts questions that carry an actual score. Subjective questions are
 * stored with `score = NULL` (manual review) and are reported separately rather
 * than being counted as zeros, which would have manufactured a fake "gap".
 */
export interface SkillBreakdown {
  skill: string;
  questions: number;
  scored: number;
  /** Null when nothing objective was scored for this skill. */
  earned: number | null;
  available: number;
  percentage: number | null;
  verdict: 'strength' | 'gap' | 'neutral' | 'needs_review';
}

export function aggregateSkillBreakdown(
  questions: Array<Pick<RawQuestion, 'id' | 'skill_tag' | 'marks'>>,
  answers: Array<{ question_id?: string; score: number | null; max_score: number | null }>,
): SkillBreakdown[] {
  // Per-question earned/available, straight from the persisted answer rows.
  const scoreByQuestionId = new Map<string, { score: number | null; max: number | null }>();
  for (const a of answers) {
    if (a.question_id) scoreByQuestionId.set(a.question_id, { score: a.score, max: a.max_score });
  }

  const buckets = new Map<string, SkillBreakdown>();
  for (const q of questions) {
    const skill = (q.skill_tag || '').trim() || 'Untagged';
    const bucket =
      buckets.get(skill) ??
      {
        skill,
        questions: 0,
        scored: 0,
        earned: null,
        available: 0,
        percentage: null,
        verdict: 'neutral' as const,
      };

    bucket.questions += 1;

    const scored = scoreByQuestionId.get(q.id);
    if (!scored || scored.score == null) {
      // Subjective or unanswered — track as available, not as a zero.
      bucket.available += Number(q.marks) || 0;
      buckets.set(skill, bucket);
      continue;
    }

    bucket.scored += 1;
    const max = Number(scored.max ?? q.marks) || 0;
    bucket.earned = (bucket.earned ?? 0) + Number(scored.score);
    bucket.available += max;
    buckets.set(skill, bucket);
  }

  const result: SkillBreakdown[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.earned == null || bucket.available <= 0) {
      bucket.verdict = bucket.questions > 0 && bucket.scored === 0 ? 'needs_review' : 'neutral';
    } else {
      const pct = Math.round((bucket.earned / bucket.available) * 1000) / 10;
      bucket.percentage = pct;
      bucket.verdict = pct >= 75 ? 'strength' : pct <= 40 ? 'gap' : 'neutral';
    }
    result.push(bucket);
  }

  return result.sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1));
}