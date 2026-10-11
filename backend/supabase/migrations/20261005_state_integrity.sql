-- ============================================================
-- HireStack: state-model + audit integrity (2026-10-05)
--
-- Fixes three silent failures found during audit:
--
-- 1. `recruiter_activity` was NEVER created by any migration, yet
--    `services/activity.ts` writes to it and `historyController` reads from
--    it. Every logActivity() call therefore failed and was swallowed by a
--    catch — the entire activity/audit feed was dead in production.
--
-- 2. `candidate_status_log.status` carried a CHECK constraint listing only
--    the legacy 11 statuses. The canonical pipeline stages ('Assessment',
--    'Technical Interview', 'Managerial/HR', 'Offer') and the outcomes
--    ('Hold', 'Withdrawn') are NOT in that list, so progressionService's
--    timeline inserts silently failed and candidate history was lost.
--
-- 3. `candidate_status_log` had no `job_id`, so a candidate's stage history
--    across two jobs was indistinguishable.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. recruiter_activity (was indexed but never created)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recruiter_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recruiter_id UUID NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruiter_activity_recruiter_created
  ON recruiter_activity (recruiter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recruiter_activity_action_type
  ON recruiter_activity (action_type);
CREATE INDEX IF NOT EXISTS idx_recruiter_activity_candidate
  ON recruiter_activity (candidate_id)
  WHERE candidate_id IS NOT NULL;

-- ------------------------------------------------------------
-- 2. Widen candidate_status_log to the canonical hiring lifecycle
--
-- Pipeline:   Applied, Screening, Assessment, Technical Interview,
--             Managerial/HR, Offer, Hired
-- Outcomes:   Rejected, Withdrawn, Hold
-- Legacy:     the pre-existing 11 values are retained so historical rows
--             and any older writers keep working.
-- ------------------------------------------------------------
ALTER TABLE candidate_status_log DROP CONSTRAINT IF EXISTS candidate_status_log_status_check;
ALTER TABLE candidate_status_log ADD CONSTRAINT candidate_status_log_status_check
  CHECK (status IN (
    -- canonical pipeline
    'Applied','Screening','Assessment','Technical Interview','Managerial/HR','Offer','Hired',
    -- terminal / parking outcomes
    'Rejected','Hold','Withdrawn',
    -- legacy statuses retained for backward compatibility
    'Shortlisted','Interview','Interview Scheduled','Interview Completed',
    'Technical Round','HR Round','Offered','Pending'
  ));

-- candidates.current_status has no CHECK at all today. Add one so a bad
-- writer cannot inject an arbitrary stage string into the pipeline.
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_current_status_check;
ALTER TABLE candidates ADD CONSTRAINT candidates_current_status_check
  CHECK (current_status IS NULL OR current_status IN (
    'Applied','Screening','Assessment','Technical Interview','Managerial/HR','Offer','Hired',
    'Rejected','Hold','Withdrawn',
    'Shortlisted','Interview','Interview Scheduled','Interview Completed',
    'Technical Round','HR Round','Offered','Pending'
  ));

-- ------------------------------------------------------------
-- 3. Job-scoped timeline
-- ------------------------------------------------------------
ALTER TABLE candidate_status_log ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
-- Attribution: progressionService previously wrote changed_by='' and left
-- recruiter_id null, so automated transitions had no actor at all.
ALTER TABLE candidate_status_log ADD COLUMN IF NOT EXISTS recruiter_id UUID REFERENCES recruiters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_status_log_job
  ON candidate_status_log (job_id, changed_at DESC)
  WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_candidate_status_log_recruiter
  ON candidate_status_log (recruiter_id)
  WHERE recruiter_id IS NOT NULL;

DO $$
DECLARE
  v_activity BOOLEAN;
  v_constraint BOOLEAN;
BEGIN
  SELECT to_regclass('public.recruiter_activity') IS NOT NULL INTO v_activity;
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidate_status_log_status_check'
  ) INTO v_constraint;

  RAISE NOTICE 'STATE INTEGRITY MIGRATION: recruiter_activity=% status_check=%',
    v_activity, v_constraint;
  IF NOT v_activity OR NOT v_constraint THEN
    RAISE EXCEPTION 'State integrity migration incomplete';
  END IF;
END
$$;