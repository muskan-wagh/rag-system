-- =============================================================================
-- HireStack — Immutable assessment snapshots + honest delivery status
-- =============================================================================
-- HireStack scored every submission against the LIVE `assessment_questions`
-- rows. That made an assessment silently mutable after candidates had already
-- taken it: unpublishing, deleting a question, reordering, or regenerating one
-- changed the grading of attempts that were already in flight or already
-- submitted. An issued invitation link could therefore mean two different
-- assessments at two different times.
--
-- This migration introduces an immutable, versioned snapshot of the published
-- question set. Every invite and every attempt is bound to the exact
-- `snapshot_version` that existed when it was issued.
--
-- `published_snapshot` holds the complete question set INCLUDING every
-- grading-critical field (correct option, hidden test cases and their expected
-- output, expected query/result, rubric, marks, position). It is written ONLY
-- on publish, and is never updated by any question mutation — draft editing
-- stays fully available, it simply produces a new version at the next publish.
--
-- Historical data
-- ---------------
-- Attempts that predate this migration are NOT given a fabricated snapshot.
-- Their `snapshot_version` stays NULL and `snapshot_source` stays 'live', and
-- reports render an explicit "historical question set unavailable" note. Their
-- existing scores are left untouched. Pretending reproducibility we do not
-- have would be worse than admitting the gap.
--
-- Delivery status
-- ---------------
-- `assessment_invites.delivery_status` records what actually happened to the
-- email: 'pending' (handed to the queue), 'sent' (provider accepted), 'failed'
-- (provider rejected or was unconfigured). The previous code wrote an
-- `email_logs` row with status 'queued' and never updated it, because
-- `enqueueEmail` dropped the `idempotencyKey` the worker needs to find the row
-- — so the UI could only ever guess. That gap is closed in
-- `services/queue/emailQueue.ts`.
--
-- Idempotent: safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Snapshot on the assessment itself.
-- -----------------------------------------------------------------------------
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS published_snapshot JSONB;

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS snapshot_version INT NOT NULL DEFAULT 0;

ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_snapshot_version_check;

ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_snapshot_version_check CHECK (snapshot_version >= 0);

COMMENT ON COLUMN public.assessments.published_snapshot IS
  'Immutable copy of the published question set, written only by publishAssessmentHandler. Never mutated by question edits. Holds answer keys — never expose to candidates.';
COMMENT ON COLUMN public.assessments.snapshot_version IS
  'Monotonic publish counter. 0 = never published under snapshotting. Incremented in the same conditional write that stores published_snapshot.';

-- -----------------------------------------------------------------------------
-- 2. Bind invites to the exact published version + the application they belong to.
-- -----------------------------------------------------------------------------
ALTER TABLE public.assessment_invites
  ADD COLUMN IF NOT EXISTS snapshot_version INT;

-- `assessment_invites` historically keyed off the candidate alone, so the same
-- person could be "invited" to a job they were never shortlisted for. This
-- binds the invite to the actual `job_applications` row.
ALTER TABLE public.assessment_invites
  ADD COLUMN IF NOT EXISTS job_application_id UUID
  REFERENCES public.job_applications(id) ON DELETE SET NULL;

ALTER TABLE public.assessment_invites
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.assessment_invites
  DROP CONSTRAINT IF EXISTS assessment_invites_delivery_status_check;

ALTER TABLE public.assessment_invites
  ADD CONSTRAINT assessment_invites_delivery_status_check
  CHECK (delivery_status IN ('pending', 'sent', 'failed'));

COMMENT ON COLUMN public.assessment_invites.snapshot_version IS
  'Published version this link was issued against. Never bumped on resend — an already-issued URL must keep meaning the same assessment.';
COMMENT ON COLUMN public.assessment_invites.delivery_status IS
  'Real email outcome. pending = queued, sent = provider accepted, failed = provider rejected or unconfigured. Never optimistically set to sent.';

-- Backfill the application link where the pairing is unambiguous.
UPDATE public.assessment_invites ai
   SET job_application_id = ja.id
  FROM public.assessments a,
       public.job_applications ja
 WHERE ai.job_application_id IS NULL
   AND a.id = ai.assessment_id
   AND a.job_id IS NOT NULL
   AND ja.candidate_id = ai.candidate_id
   AND ja.job_id = a.job_id;

-- Defence in depth alongside the blanket `UNIQUE (assessment_id, candidate_id)`
-- from 20261001. That constraint is kept so historical rows cannot be
-- duplicated wholesale; this partial index states the rule the application
-- actually depends on (a revoked invite is dead by recruiter action and may be
-- replaced by a fresh link).
DROP INDEX IF EXISTS public.uq_assessment_invites_active_invite;

CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_invites_active_invite
  ON public.assessment_invites (assessment_id, candidate_id)
  WHERE status <> 'revoked';

CREATE INDEX IF NOT EXISTS idx_assessment_invites_application
  ON public.assessment_invites (job_application_id);

-- -----------------------------------------------------------------------------
-- 3. Pin the version onto every attempt.
-- -----------------------------------------------------------------------------
ALTER TABLE public.assessment_attempts
  ADD COLUMN IF NOT EXISTS snapshot_version INT;

ALTER TABLE public.assessment_attempts
  ADD COLUMN IF NOT EXISTS snapshot_source TEXT NOT NULL DEFAULT 'live';

ALTER TABLE public.assessment_attempts
  DROP CONSTRAINT IF EXISTS assessment_attempts_snapshot_source_check;

ALTER TABLE public.assessment_attempts
  ADD CONSTRAINT assessment_attempts_snapshot_source_check
  CHECK (snapshot_source IN ('snapshot', 'live'));

COMMENT ON COLUMN public.assessment_attempts.snapshot_source IS
  'snapshot = grade against published_snapshot at snapshot_version. live = pre-migration attempt graded against assessment_questions at submit time; its historical question set is not recoverable and reports must say so.';

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_snapshot
  ON public.assessment_attempts (assessment_id, snapshot_version);

-- -----------------------------------------------------------------------------
-- 4. Record the version on reports so a PDF says which version it describes.
-- -----------------------------------------------------------------------------
ALTER TABLE public.candidate_reports
  ADD COLUMN IF NOT EXISTS snapshot_version INT;

ALTER TABLE public.candidate_reports
  ADD COLUMN IF NOT EXISTS application_id UUID
  REFERENCES public.job_applications(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.candidate_reports.snapshot_version IS
  'Assessment version this report was built from. NULL means the underlying attempt predates snapshotting.';

CREATE INDEX IF NOT EXISTS idx_candidate_reports_application
  ON public.candidate_reports (job_id, application_id);

-- -----------------------------------------------------------------------------
-- 5. Snapshot integrity: only the publish path may write published_snapshot.
-- -----------------------------------------------------------------------------
-- Enforced in application code (the service role is the only writer and
-- `publishAssessmentHandler` is the only call site that sets it), but the
-- version/snapshot pairing is checked here so a partial write is impossible to
-- represent: a non-zero version always has a snapshot, and vice versa.
ALTER TABLE public.assessments
  DROP CONSTRAINT IF EXISTS assessments_snapshot_pairing_check;

ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_snapshot_pairing_check
  CHECK (
    (snapshot_version = 0 AND published_snapshot IS NULL)
    OR (snapshot_version > 0 AND published_snapshot IS NOT NULL)
  );

DO $$
DECLARE
  stale BIGINT;
BEGIN
  SELECT count(*) INTO stale FROM public.assessments
   WHERE published_snapshot IS NOT NULL AND snapshot_version = 0;
  IF stale > 0 THEN
    RAISE WARNING
      '% assessment(s) carry a snapshot with version 0; publishAssessmentHandler will overwrite them on next publish', stale;
  END IF;

  RAISE NOTICE
    'assessment snapshotting ready — % attempt(s) marked as historical (snapshot_source=live)',
    (SELECT count(*) FROM public.assessment_attempts WHERE snapshot_source = 'live');
END $$;
-- -----------------------------------------------------------------------------
-- 7. Version history.
-- -----------------------------------------------------------------------------
-- `assessments.published_snapshot` holds only the LATEST version, which is the
-- fast path for new invitations. Keeping only the latest is not sufficient: a
-- candidate holding a v1 link would find their question set overwritten the
-- moment a recruiter republished, and the attempt would either fail to grade or
-- be silently regraded against different questions.
--
-- Every publish therefore appends an immutable, version-keyed row here. Attempt
-- grading looks the pinned version up in this table. Rows are append-only —
-- nothing in the application updates or deletes them.
CREATE TABLE IF NOT EXISTS public.assessment_snapshots (
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  version INT NOT NULL CHECK (version >= 1),
  /** Complete question set INCLUDING answer keys. Server-side only. */
  snapshot JSONB NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_by UUID REFERENCES public.recruiters(id) ON DELETE SET NULL,
  PRIMARY KEY (assessment_id, version)
);

CREATE INDEX IF NOT EXISTS idx_assessment_snapshots_published_at
  ON public.assessment_snapshots (assessment_id, published_at DESC);

COMMENT ON TABLE public.assessment_snapshots IS
  'Immutable, version-keyed history of published assessment question sets. Append-only. An attempt is graded against the row matching its pinned snapshot_version.';
COMMENT ON COLUMN public.assessment_snapshots.snapshot IS
  'Holds answer keys. Never serialize to a candidate; apply sanitizeQuestions on every candidate-facing read.';

ALTER TABLE public.assessment_snapshots
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_assessment_snapshots" ON public.assessment_snapshots;
CREATE POLICY "service_role_all_assessment_snapshots" ON public.assessment_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Backfill: where an assessment already carries a snapshot (a publish that ran
-- before this table existed), seed its history from it. Attempts pinned to an
-- earlier version than this remain ungradeable and are reported as such rather
-- than being regraded against the wrong question set.
INSERT INTO public.assessment_snapshots (assessment_id, version, snapshot, published_at)
SELECT a.id, a.snapshot_version, a.published_snapshot,
       COALESCE((a.published_snapshot ->> 'published_at')::timestamptz, NOW())
  FROM public.assessments a
 WHERE a.published_snapshot IS NOT NULL
   AND a.snapshot_version > 0
ON CONFLICT (assessment_id, version) DO NOTHING;
