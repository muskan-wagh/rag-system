-- Dashboard performance improvements
-- Run in Supabase SQL Editor
-- NOTE: The runtime code works without these (graceful fallbacks), but applying
-- them is required for full benefit: server-side pool aggregation + index-friendly
-- stats RPC.

-- =============================================================================
-- STEP 0: Preflight check.
-- Must be run against the SAME project the backend uses (project ref in
-- backend/.env -> SUPABASE_URL, currently: eqebnwpzbszjdntbjbpw).
-- If you get "column \"current_status\" does not exist", you are in a DIFFERENT
-- database/project — switch the project dropdown in the SQL editor and re-run.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'candidates'
      AND column_name = 'current_status'
  ) THEN
    RAISE EXCEPTION
      'PRECONDITION FAILED: public.candidates has no current_status column. '
      'You are likely connected to the wrong Supabase project. Expected project ref: eqebnwpzbszjdntbjbpw';
  END IF;
END
$$;

-- =============================================================================
-- STEP 1: Expression index so LOWER(current_status) filters in
-- get_recruiter_stats can use an index instead of scanning every row of the
-- recruiter's candidates.
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_candidates_recruiter_lower_status
  ON public.candidates (recruiter_id, LOWER(current_status));

-- =============================================================================
-- STEP 2: Server-side talent pool aggregation view.
-- Replaces the unbounded `talent_pool_candidates` join + JS aggregation in the
-- dashboard. `average_score` mirrors the previous semantics (avg of scores > 0),
-- `new_count` mirrors `match_score IS NULL`.
-- =============================================================================
CREATE OR REPLACE VIEW public.talent_pool_summary AS
SELECT
  tp.id,
  tp.recruiter_id,
  tp.name,
  tp.updated_at,
  COUNT(tpc.id)::int AS candidate_count,
  COALESCE(ROUND(AVG(tpc.match_score) FILTER (WHERE tpc.match_score > 0)), 0)::int AS average_score,
  COUNT(tpc.id) FILTER (WHERE tpc.match_score IS NULL)::int AS new_count
FROM public.talent_pools tp
LEFT JOIN public.talent_pool_candidates tpc ON tpc.pool_id = tp.id
GROUP BY tp.id, tp.recruiter_id, tp.name, tp.updated_at;

-- =============================================================================
-- STEP 3: Optimized stats RPC:
--  - Drops the unused `upload_days` CTE (dead work).
--  - LOWER() status filters are now sargable via the expression index above.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_recruiter_stats(p_recruiter_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH session_ids AS (
    SELECT id FROM public.upload_sessions WHERE recruiter_id = p_recruiter_id
  ),
  status_agg AS (
    SELECT
      COUNT(*) FILTER (WHERE LOWER(c.current_status) IN ('applied','shortlisted')) AS open,
      COUNT(*) FILTER (WHERE LOWER(c.current_status) = 'applied') AS applied,
      COUNT(*) FILTER (WHERE LOWER(c.current_status) = 'screening') AS screening,
      COUNT(*) FILTER (WHERE LOWER(c.current_status) = 'interview') AS interview,
      COUNT(*) FILTER (WHERE LOWER(c.current_status) = 'offered') AS offered,
      COUNT(*) FILTER (WHERE LOWER(c.current_status) = 'hired') AS hired,
      COUNT(*) FILTER (WHERE LOWER(c.current_status) = 'rejected') AS rejected
    FROM public.candidates c
    WHERE c.recruiter_id = p_recruiter_id
  ),
  interview_count AS (
    SELECT COUNT(*) AS interviews_today
    FROM public.interviews i
    JOIN public.candidates c ON c.id = i.candidate_id
    WHERE c.recruiter_id = p_recruiter_id
      AND i.scheduled_date = CURRENT_DATE
      AND i.status = 'scheduled'
  ),
  candidate_counts AS (
    SELECT
      COUNT(*) AS total_candidates,
      COUNT(*) FILTER (WHERE c.created_at >= CURRENT_DATE) AS uploaded_today
    FROM public.candidates c
    WHERE c.recruiter_id = p_recruiter_id
  ),
  search_counts AS (
    SELECT COUNT(*) AS searches
    FROM public.search_sessions s
    WHERE s.recruiter_id = p_recruiter_id
  )
  SELECT json_build_object(
    'open', sa.open,
    'applied', sa.applied,
    'screening', sa.screening,
    'interview', sa.interview,
    'interviewsToday', ic.interviews_today,
    'offered', sa.offered,
    'hired', sa.hired,
    'rejected', sa.rejected,
    'totalCandidates', cc.total_candidates,
    'uploadedToday', cc.uploaded_today,
    'activeSessions', (SELECT COUNT(*) FROM session_ids),
    'searches', sc.searches
  ) INTO result
  FROM status_agg sa, interview_count ic, candidate_counts cc, search_counts sc;

  RETURN result;
END;
$$ LANGUAGE plpgsql;
