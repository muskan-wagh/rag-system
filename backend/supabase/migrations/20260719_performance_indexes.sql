-- Phase 7 — Composite database indexes for dashboard + timeline queries
-- Run in Supabase SQL Editor
-- NOTE: interviews table does NOT have a recruiter_id column, so that index was omitted

-- Dashboard: filter by recruiter + status (Needs Review, etc.)
CREATE INDEX IF NOT EXISTS idx_candidates_recruiter_status
  ON candidates (recruiter_id, current_status);

-- Dashboard: recruiter's candidates ordered by creation date
CREATE INDEX IF NOT EXISTS idx_candidates_recruiter_created
  ON candidates (recruiter_id, created_at DESC);

-- Timeline: candidate status changes ordered by time
CREATE INDEX IF NOT EXISTS idx_candidate_status_log_candidate_created
  ON candidate_status_log (candidate_id, changed_at DESC);

-- Activity/History: recruiter activity ordered by time
CREATE INDEX IF NOT EXISTS idx_recruiter_activity_recruiter_created
  ON recruiter_activity (recruiter_id, created_at DESC);

-- Activity: filter by action type
CREATE INDEX IF NOT EXISTS idx_recruiter_activity_action_type
  ON recruiter_activity (action_type);

-- Candidate notes: loaded per candidate in order
CREATE INDEX IF NOT EXISTS idx_candidate_notes_candidate_created
  ON candidate_notes (candidate_id, created_at DESC);

-- Talent pool candidates: per-pool score queries
CREATE INDEX IF NOT EXISTS idx_talent_pool_candidates_pool_score
  ON talent_pool_candidates (pool_id, match_score DESC);
