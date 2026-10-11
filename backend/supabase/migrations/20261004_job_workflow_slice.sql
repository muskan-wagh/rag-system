-- ============================================================
-- HireStack Connected Workflow slice (2026-10-04)
-- Per-job progression config — recruiter-controlled automation.
--
-- REUSES: jobs, hiring_stages(config), progressionService.
-- NEW: jobs.progression_config JSONB only (no new tables).
--
-- Semantics:
--   screening_to_assessment: screening pass marks candidate
--     Assessment-eligible (status advance only, never emails).
--   assessment_to_technical: assessment pass enqueues Technical
--     Interview creation via progressionService.
--   technical_to_hr / hr_to_offer: evaluation pass advances stage.
-- Invitation emails ALWAYS stay recruiter-triggered unless the
-- matching *_auto_invite flag is explicitly enabled.
-- Final Hire decision is NEVER automatic.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS progression_config JSONB NOT NULL DEFAULT
  '{"screening_to_assessment":false,"assessment_to_technical":false,"technical_to_hr":false,"hr_to_offer":false,"assessment_auto_invite":false,"interview_auto_invite":false}';

-- Backfill rows that predate the default (defaults cover new rows).
UPDATE jobs
SET progression_config = '{"screening_to_assessment":false,"assessment_to_technical":false,"technical_to_hr":false,"hr_to_offer":false,"assessment_auto_invite":false,"interview_auto_invite":false}'
WHERE progression_config IS NULL
   OR NOT (progression_config ?& array['screening_to_assessment','assessment_to_technical','technical_to_hr','hr_to_offer','assessment_auto_invite','interview_auto_invite']);

-- ------------------------------------------------------------
-- Forward job linkage for interviews (nullable; written by new code).
-- Lets every interview/invite resolve its job directly instead of
-- guessing via the latest assessment attempt.
-- ------------------------------------------------------------
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE interview_invites ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_interviews_job ON interviews(job_id);
CREATE INDEX IF NOT EXISTS idx_interview_invites_job ON interview_invites(job_id);

DO $$
DECLARE
  v_jobs INT;
BEGIN
  SELECT COUNT(*) INTO v_jobs FROM jobs;
  RAISE NOTICE 'JOB WORKFLOW SLICE MIGRATION OK: jobs=%', v_jobs;
END
$$;
