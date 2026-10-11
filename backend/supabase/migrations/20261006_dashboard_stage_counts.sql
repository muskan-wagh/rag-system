-- ============================================================
-- HireStack: dashboard stage aggregation (2026-10-06)
--
-- The dashboard RPC counted only the legacy 7 statuses. Candidates whose
-- current_status was a canonical pipeline stage ('Assessment',
-- 'Technical Interview', 'Managerial/HR', 'Offer') or a parking outcome
-- ('Hold', 'Withdrawn') matched NO filter and were silently omitted from
-- every metric — so a pipeline that had advanced past Screening showed zero
-- candidates above that point.
--
-- Fixes:
--   1. Count every canonical stage + outcome.
--   2. Keep counts MUTUALLY EXCLUSIVE. Each candidate contributes to
--      exactly one `current_status` bucket, so a candidate who passed
--      Screening yesterday and sits in Assessment today is counted once,
--      as Assessment — never as both. Historical pass rates are exposed
--      separately with an explicit denominator.
--   3. Add an optional `p_job_id` filter so job-level dashboards are
--      scoped to real persisted data for that job.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- PREREQUISITE: `interviews.job_id` is created by
-- 20261004_job_workflow_slice.sql. This function filters interviews by job,
-- so without that column Postgres rejects the function body with an opaque
-- "column i.job_id does not exist". Fail early with an actionable message.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'interviews' AND column_name = 'job_id'
  ) THEN
    RAISE EXCEPTION
      'Missing prerequisite: interviews.job_id does not exist. Apply 20261004_job_workflow_slice.sql BEFORE 20261006_dashboard_stage_counts.sql.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_recruiter_stats(p_recruiter_id UUID, p_job_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH scoped_candidates AS (
    -- When a job is selected, restrict to candidates actually linked to it.
    -- `screening_results` is the authoritative (job_id, candidate_id) pair and
    -- is UNIQUE per pair; assessments/interviews are linked via job_id.
    SELECT c.id, c.current_status
    FROM public.candidates c
    WHERE c.recruiter_id = p_recruiter_id
      AND (
        p_job_id IS NULL
        OR c.id IN (
          SELECT sr.candidate_id FROM public.screening_results sr WHERE sr.job_id = p_job_id
          UNION
          SELECT aa.candidate_id
          FROM public.assessment_attempts aa
          JOIN public.assessments a ON a.id = aa.assessment_id
          WHERE a.job_id = p_job_id
          UNION
          SELECT ai.candidate_id
          FROM public.assessment_invites ai
          JOIN public.assessments a ON a.id = ai.assessment_id
          WHERE a.job_id = p_job_id
          UNION
          SELECT i.candidate_id FROM public.interviews i WHERE i.job_id = p_job_id
          UNION
          SELECT pe.candidate_id FROM public.hiring_progression_events pe WHERE pe.job_id = p_job_id
        )
      )
  ),
  status_agg AS (
    SELECT
      COUNT(*) AS total_in_scope,

      -- Current-stage buckets. `current_status` is a single column, so these
      -- are inherently mutually exclusive.
      COUNT(*) FILTER (WHERE LOWER(current_status) = 'applied')      AS applied,
      COUNT(*) FILTER (WHERE LOWER(current_status) = 'screening')    AS screening,
      COUNT(*) FILTER (WHERE LOWER(current_status) = 'assessment')   AS assessment,
      COUNT(*) FILTER (
        WHERE LOWER(current_status) IN ('technical interview', 'technical round', 'interview')
      )                                                              AS technical,
      COUNT(*) FILTER (
        WHERE LOWER(current_status) IN ('managerial/hr', 'hr round', 'hr interview')
      )                                                              AS hr,
      COUNT(*) FILTER (WHERE LOWER(current_status) = 'offer')        AS final_decision,
      COUNT(*) FILTER (WHERE LOWER(current_status) IN ('offered'))    AS offered,
      COUNT(*) FILTER (WHERE LOWER(current_status) = 'hired')        AS hired,
      COUNT(*) FILTER (WHERE LOWER(current_status) = 'rejected')     AS rejected,
      COUNT(*) FILTER (WHERE LOWER(current_status) IN ('hold', 'withdrawn')) AS on_hold

      -- "Open" = everything not yet a terminal outcome.
      - COUNT(*) FILTER (
          WHERE LOWER(current_status) IN ('hired', 'rejected', 'withdrawn')
        )                                                             AS open_candidates
    FROM scoped_candidates
  ),
  historical AS (
    -- Separate, clearly-denominated historical metrics. These count EVENTS,
    -- not current stage, and must not be added to the stage buckets above.
    SELECT
      (SELECT COUNT(*) FROM public.screening_results sr WHERE sr.status = 'passed'
         AND (p_job_id IS NULL OR sr.job_id = p_job_id))              AS screening_passed,
      (SELECT COUNT(*) FROM public.screening_results sr WHERE sr.status = 'failed'
         AND (p_job_id IS NULL OR sr.job_id = p_job_id))              AS screening_failed,
      (SELECT COUNT(*) FROM public.screening_results sr
         WHERE (p_job_id IS NULL OR sr.job_id = p_job_id))            AS screening_total
  ),
  interview_count AS (
    SELECT COUNT(*) AS interviews_today
    FROM public.interviews i
    JOIN public.candidates c ON c.id = i.candidate_id
    WHERE c.recruiter_id = p_recruiter_id
      AND i.scheduled_date = CURRENT_DATE
      AND i.status = 'scheduled'
      AND (p_job_id IS NULL OR i.job_id = p_job_id)
  ),
  candidate_counts AS (
    SELECT
      COUNT(*) AS total_candidates,
      COUNT(*) FILTER (WHERE c.created_at >= CURRENT_DATE) AS uploaded_today
    FROM public.candidates c
    WHERE c.recruiter_id = p_recruiter_id
      AND (p_job_id IS NULL OR c.id IN (SELECT id FROM scoped_candidates))
  ),
  search_counts AS (
    SELECT COUNT(*) AS searches
    FROM public.search_sessions s
    WHERE s.recruiter_id = p_recruiter_id
  )
  SELECT json_build_object(
    -- Current stage counts (mutually exclusive)
    'open',             sa.open_candidates,
    'applied',          sa.applied,
    'screening',        sa.screening,
    'assessment',       sa.assessment,
    'technical',        sa.technical,
    'hr',               sa.hr,
    'finalDecision',    sa.final_decision,
    'offered',          sa.offered,
    'hired',            sa.hired,
    'rejected',         sa.rejected,
    'onHold',           sa.on_hold,
    -- Kept for backwards compatibility with the existing dashboard payload.
    'interview',        sa.technical + sa.hr,
    'interviewsToday',  ic.interviews_today,
    -- Historical (event-based, with explicit denominators)
    'screeningPassed',  h.screening_passed,
    'screeningFailed',  h.screening_failed,
    'screeningTotal',   h.screening_total,
    -- Totals
    'totalCandidates',  cc.total_candidates,
    'uploadedToday',    cc.uploaded_today,
    'totalInScope',     sa.total_in_scope,
    'searches',         sc.searches,
    'jobId',            p_job_id
  ) INTO result
  FROM status_agg sa, interview_count ic, candidate_counts cc, search_counts sc, historical h;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Recruiters are authenticated by Clerk; all access goes through the service
-- role client, so RLS stays service-role-only as elsewhere.
GRANT EXECUTE ON FUNCTION public.get_recruiter_stats(UUID, UUID) TO service_role;

DO $$
BEGIN
  RAISE NOTICE 'DASHBOARD AGGREGATION MIGRATION: get_recruiter_stats now covers all canonical stages + job scoping';
END
$$;