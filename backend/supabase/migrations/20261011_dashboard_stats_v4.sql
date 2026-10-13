-- =============================================================================
-- HireStack — dashboard stats v4 (canonical application stage)
-- =============================================================================
-- v3 counted `candidates.current_status`, a single GLOBAL column. That made the
-- dashboard structurally incapable of answering the question a recruiter
-- actually asks in a multi-job pipeline: "how many people are in Assessment for
-- THIS job?".
--
-- It could not be patched in place. `candidates.current_status` is being
-- demoted to a compatibility mirror, refreshed only when a candidate has
-- exactly one application. Counting from it would therefore under-report every
-- multi-application candidate.
--
-- v4 derives stage from `job_applications.current_stage` — the authoritative
-- per-job record. Consequences, all intentional:
--
--   * A candidate in three jobs can be Shortlisted in one, in Assessment in
--     another, and Rejected in a third, and the dashboard counts each job's
--     view independently. That was impossible under v3, which had exactly one
--     status per candidate for the whole product.
--   * Job scoping (`p_job_id`) becomes exact instead of best-effort. v3
--     approximated membership by UNIONing five unrelated tables, which both
--     over-counted (a candidate merely mentioned anywhere in the job's history)
--     and under-counted (an application with no screening result, no interview
--     and no attempt was invisible).
--   * Every JSON key from v3 is preserved, so the dashboard contract does not
--     break. `shortlisted` is added, and `technical` / `hr` are renamed to
--     match the new stage vocabulary.
--
-- Counters are mutually exclusive: each APPLICATION contributes to exactly one
-- stage bucket. When no job is selected, a candidate with several applications
-- is counted once per application, and `totalInScope` / `totalCandidates`
-- report DISTINCT candidates so the ratio between them stays interpretable.
--
-- Idempotent: safe to re-run.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'job_applications'
       AND column_name = 'current_stage'
  ) THEN
    RAISE EXCEPTION
      'Missing prerequisite: job_applications.current_stage does not exist. Apply 20261007_job_applications.sql BEFORE 20261011_dashboard_stats_v4.sql.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'job_applications'
       AND column_name = 'shortlisted_at'
  ) THEN
    RAISE EXCEPTION
      'Missing prerequisite: job_applications.shortlisted_at does not exist. Apply 20261009_canonical_stage_vocabulary.sql BEFORE 20261011_dashboard_stats_v4.sql.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_recruiter_stats(p_recruiter_id UUID, p_job_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH scoped_apps AS (
    -- The authoritative unit is the APPLICATION, not the candidate.
    --
    -- Ownership is resolved from `candidates.recruiter_id` rather than
    -- `job_applications.recruiter_id`: the latter is nullable and backfilled by
    -- 20261009 only where it was empty, so a partially backfilled database
    -- would silently drop rows from the dashboard. Candidates are the tenant
    -- boundary in HireStack, so that is the correct key either way.
    SELECT ja.id           AS application_id,
           ja.job_id,
           ja.candidate_id,
           ja.current_stage
      FROM public.job_applications ja
      JOIN public.candidates c ON c.id = ja.candidate_id
     WHERE c.recruiter_id = p_recruiter_id
       AND ja.job_id IS NOT NULL
       AND (p_job_id IS NULL OR ja.job_id = p_job_id)
  ),
  stage_agg AS (
    SELECT
      COUNT(*) AS applications,

      -- Current-stage buckets. `current_stage` is a single column, so these are
      -- inherently mutually exclusive. Legacy values are still counted so a row
      -- the 20261009 rewrite skipped degrades into the right bucket instead of
      -- vanishing.
      COUNT(*) FILTER (WHERE LOWER(current_stage) = 'applied')          AS applied,
      COUNT(*) FILTER (WHERE LOWER(current_stage) = 'screening')        AS screening,
      COUNT(*) FILTER (WHERE LOWER(current_stage) = 'shortlisted')      AS shortlisted,
      COUNT(*) FILTER (WHERE LOWER(current_stage) = 'assessment')       AS assessment,
      COUNT(*) FILTER (
        WHERE LOWER(current_stage) IN ('technical round', 'technical interview')
      )                                                                AS technical,
      COUNT(*) FILTER (
        WHERE LOWER(current_stage) IN ('interview', 'managerial/hr', 'hr round')
      )                                                                AS hr,
      COUNT(*) FILTER (
        WHERE LOWER(current_stage) IN ('final decision', 'offer', 'offered')
      )                                                                AS final_decision,
      COUNT(*) FILTER (WHERE LOWER(current_stage) = 'hired')            AS hired,
      COUNT(*) FILTER (WHERE LOWER(current_stage) = 'rejected')         AS rejected,
      COUNT(*) FILTER (
        WHERE LOWER(current_stage) IN ('hold', 'withdrawn')
      )                                                                AS on_hold,

      -- "Open" = every application not yet at a terminal outcome.
      COUNT(*) FILTER (
        WHERE LOWER(current_stage) NOT IN ('hired', 'rejected', 'withdrawn')
          AND current_stage IS NOT NULL
      )                                                                AS open_candidates
    FROM scoped_apps
  ),
  candidate_agg AS (
    SELECT
      COUNT(*)                                                          AS total_candidates,
      COUNT(*) FILTER (WHERE c.created_at >= CURRENT_DATE)             AS uploaded_today,
      COUNT(DISTINCT sa.candidate_id)                                   AS total_in_scope
      FROM public.candidates c
      LEFT JOIN scoped_apps sa ON sa.candidate_id = c.id
     WHERE c.recruiter_id = p_recruiter_id
       AND (p_job_id IS NULL OR sa.application_id IS NOT NULL)
  ),
  screening_agg AS (
    -- HISTORICAL, event-based. These count screening OUTCOMES, not current
    -- stage, and must never be added to the stage buckets above.
    SELECT
      COUNT(*) FILTER (WHERE sr.status IN ('passed', 'overridden'))  AS screening_passed,
      COUNT(*) FILTER (WHERE sr.status = 'failed')                  AS screening_failed,
      COUNT(*)                                                      AS screening_total
      FROM public.screening_results sr
      JOIN public.candidates c ON c.id = sr.candidate_id
     WHERE c.recruiter_id = p_recruiter_id
       AND (p_job_id IS NULL OR sr.job_id = p_job_id)
  ),
  assessment_agg AS (
    -- Assessment funnel, scoped through the job so one job's assessment activity
    -- never leaks into another's counts.
    --
    -- Written as scalar subqueries rather than a joined CTE on purpose: chaining
    -- `candidates -> assessments -> invites -> attempts` produces an unbounded
    -- cross product (every candidate against every assessment, invite and
    -- attempt) before the COUNT(DISTINCT)s collapse it. The subqueries let
    -- Postgres use the per-table indexes instead.
    SELECT
      (SELECT COUNT(*) FROM public.assessments a
        WHERE a.recruiter_id = p_recruiter_id
          AND (p_job_id IS NULL OR a.job_id = p_job_id)
          AND a.status = 'published')                                            AS assessments_published,
      (SELECT COUNT(*) FROM public.assessments a
        WHERE a.recruiter_id = p_recruiter_id
          AND (p_job_id IS NULL OR a.job_id = p_job_id)
          AND a.status <> 'published')                                           AS assessments_draft,
      (SELECT COUNT(*) FROM public.assessment_invites ai
         JOIN public.assessments a ON a.id = ai.assessment_id
        WHERE a.recruiter_id = p_recruiter_id
          AND (p_job_id IS NULL OR a.job_id = p_job_id))                        AS invites_sent,
      (SELECT COUNT(*) FROM public.assessment_invites ai
         JOIN public.assessments a ON a.id = ai.assessment_id
        WHERE a.recruiter_id = p_recruiter_id
          AND (p_job_id IS NULL OR a.job_id = p_job_id)
          AND ai.status = 'revoked')                                             AS invites_revoked,
      (SELECT COUNT(*) FROM public.assessment_attempts att
         JOIN public.assessments a ON a.id = att.assessment_id
        WHERE a.recruiter_id = p_recruiter_id
          AND (p_job_id IS NULL OR a.job_id = p_job_id)
          AND att.status = 'in_progress')                                        AS attempts_in_progress,
      (SELECT COUNT(*) FROM public.assessment_attempts att
         JOIN public.assessments a ON a.id = att.assessment_id
        WHERE a.recruiter_id = p_recruiter_id
          AND (p_job_id IS NULL OR a.job_id = p_job_id)
          AND att.status IN ('submitted', 'evaluated'))                          AS attempts_completed,
      (SELECT COUNT(*) FROM public.assessment_attempts att
         JOIN public.assessments a ON a.id = att.assessment_id
        WHERE a.recruiter_id = p_recruiter_id
          AND (p_job_id IS NULL OR a.job_id = p_job_id)
          AND att.status = 'evaluated' AND att.passed)                          AS attempts_passed,
      (SELECT COUNT(*) FROM public.assessment_attempts att
         JOIN public.assessments a ON a.id = att.assessment_id
        WHERE a.recruiter_id = p_recruiter_id
          AND (p_job_id IS NULL OR a.job_id = p_job_id)
          AND att.status = 'evaluated' AND att.passed IS FALSE)                  AS attempts_failed
  ),
  interview_agg AS (
    SELECT
      COUNT(*) FILTER (
        WHERE i.scheduled_date = CURRENT_DATE
          AND i.status = 'scheduled'
      ) AS interviews_today,
      COUNT(*) FILTER (WHERE i.status IN ('scheduled', 'joined', 'in_progress')) AS interviews_upcoming
      FROM public.interviews i
      JOIN public.candidates c ON c.id = i.candidate_id
     WHERE c.recruiter_id = p_recruiter_id
       AND (p_job_id IS NULL OR i.job_id = p_job_id)
  ),
  job_agg AS (
    SELECT
      COUNT(*)                                                        AS total_jobs,
      COUNT(*) FILTER (WHERE status = 'open')                         AS open_jobs,
      COUNT(*) FILTER (WHERE status = 'closed')                       AS closed_jobs
      FROM public.jobs
     WHERE recruiter_id = p_recruiter_id
       AND (p_job_id IS NULL OR id = p_job_id)
  ),
  search_agg AS (
    SELECT COUNT(*) AS searches FROM public.search_sessions s
     WHERE s.recruiter_id = p_recruiter_id
  )
  SELECT json_build_object(
    -- Current stage counts (mutually exclusive, per APPLICATION)
    'open',             sa.open_candidates,
    'applied',          sa.applied,
    'screening',        sa.screening,
    'shortlisted',      sa.shortlisted,
    'assessment',       sa.assessment,
    'technical',        sa.technical,
    'hr',               sa.hr,
    'finalDecision',    sa.final_decision,
    'offered',          sa.final_decision,   -- retained alias: same bucket
    'hired',            sa.hired,
    'rejected',         sa.rejected,
    'onHold',           sa.on_hold,
    -- Kept for backwards compatibility with the existing dashboard payload.
    'interview',        sa.hr,
    'interviewsToday',  ia.interviews_today,
    'interviewsUpcoming', ia.interviews_upcoming,

    -- Historical (event-based, with explicit denominators)
    'screeningPassed',  sc.screening_passed,
    'screeningFailed',  sc.screening_failed,
    'screeningTotal',   sc.screening_total,

    -- Assessment funnel (event-based)
    'assessmentsPublished', aa.assessments_published,
    'assessmentsDraft',     aa.assessments_draft,
    'assessmentInvitesSent', aa.invites_sent,
    'assessmentInvitesRevoked', aa.invites_revoked,
    'assessmentInProgress',  aa.attempts_in_progress,
    'assessmentCompleted',   aa.attempts_completed,
    'assessmentPassed',      aa.attempts_passed,
    'assessmentFailed',      aa.attempts_failed,

    -- Jobs
    'totalJobs',        ja.total_jobs,
    'openJobs',         ja.open_jobs,
    'closedJobs',       ja.closed_jobs,

    -- Totals
    'totalCandidates',  ca.total_candidates,
    'uploadedToday',    ca.uploaded_today,
    'totalInScope',     ca.total_in_scope,
    'applicationsInScope', sa.applications,
    'searches',         se.searches,
    'jobId',            p_job_id
  ) INTO result
  FROM stage_agg sa
  CROSS JOIN candidate_agg ca
  CROSS JOIN screening_agg sc
  CROSS JOIN assessment_agg aa
  CROSS JOIN interview_agg ia
  CROSS JOIN job_agg ja
  CROSS JOIN search_agg se;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_recruiter_stats(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.get_recruiter_stats(UUID, UUID) IS
  'v4. Stage buckets derive from job_applications.current_stage, so job scoping is exact and a candidate in several jobs is counted once per job.';