-- ============================================================
-- HireStack Hiring Workflow (2026-10-02) — candidate experience,
-- progression service, screening persistence, interviews, proctoring
--
-- REUSES (never duplicates):
--   jobs, hiring_stages, assessments, assessment_questions,
--   assessment_invites, candidates, candidate_status_log,
--   interviews, offers, email_logs, recruiter_activity
--
-- NEW tables (all IF NOT EXISTS, idempotent):
--   assessment_attempts, assessment_answers,
--   hiring_progression_events, screening_results,
--   interview_invites, interview_evaluations,
--   proctoring_events, candidate_sessions
--
-- Safe to re-run. Verify with notices at the end.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Clean up hiring_stages.stage_type (correction #3).
-- Target: Screening | Assessment | Technical Interview |
--   Managerial/HR | Offer | Hired
-- Legacy 'Interview' kept for backward compat (existing rows),
-- new code writes specific types. Rejected/Withdrawn/Hold are
-- application outcomes, NOT pipeline stages.
-- ------------------------------------------------------------
ALTER TABLE hiring_stages DROP CONSTRAINT IF EXISTS hiring_stages_stage_type_check;
ALTER TABLE hiring_stages ADD CONSTRAINT hiring_stages_stage_type_check
  CHECK (stage_type IN ('Screening','Assessment','Technical Interview','Managerial/HR','Interview','Offer','Hired'));

-- Backfill: none (keep existing 'Interview' rows untouched).

CREATE INDEX IF NOT EXISTS idx_hiring_stages_job_position
  ON hiring_stages(job_id, position);

-- ------------------------------------------------------------
-- 1. assessment_attempts — one row per candidate try.
-- Multiple historical attempts allowed (attempt_number);
-- only ONE in_progress attempt per (assessment, candidate)
-- enforced by partial unique index (correction #7).
-- Score is percentage-based (correction #4):
--   percentage = score / max_score * 100
--   passed = percentage >= assessments.passing_score
-- is_mock_execution guards mock fallback (correction #6).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  invite_id UUID REFERENCES assessment_invites(id) ON DELETE SET NULL,
  attempt_number INT NOT NULL DEFAULT 1 CHECK (attempt_number >= 1),
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','submitted','evaluated','expired')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  score NUMERIC,
  max_score NUMERIC,
  percentage NUMERIC CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100)),
  passed BOOLEAN,
  is_mock_execution BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assessment_id, candidate_id, attempt_number)
);

-- Exactly one active attempt per (assessment, candidate).
CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_attempts_active
  ON assessment_attempts(assessment_id, candidate_id)
  WHERE status = 'in_progress';

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_assessment
  ON assessment_attempts(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_candidate
  ON assessment_attempts(candidate_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_status
  ON assessment_attempts(status);

-- ------------------------------------------------------------
-- 2. assessment_answers — autosave + final answers.
-- score NULL = not yet scored (subjective stays NULL until
-- manual review — correction #13, never implicit zero).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
  answer JSONB NOT NULL DEFAULT '{}',
  language TEXT,
  code TEXT,
  score NUMERIC,
  max_score NUMERIC,
  is_correct BOOLEAN,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_answers_attempt
  ON assessment_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_assessment_answers_question
  ON assessment_answers(question_id);

-- ------------------------------------------------------------
-- 3. hiring_progression_events — explicit idempotency
-- (correction #8). One row per triggering event; UNIQUE on
-- (trigger_type, trigger_id) guarantees exactly-once even if
-- submit is called twice, worker retries, or server restarts.
-- All transitions go through progressionService (correction #1).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hiring_progression_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  from_stage TEXT NOT NULL DEFAULT '',
  to_stage TEXT NOT NULL DEFAULT '',
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN ('assessment_submission','technical_evaluation','hr_evaluation','screening','manual','offer')),
  trigger_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','failed','skipped')),
  error TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trigger_type, trigger_id)
);

CREATE INDEX IF NOT EXISTS idx_progression_candidate
  ON hiring_progression_events(candidate_id);
CREATE INDEX IF NOT EXISTS idx_progression_status
  ON hiring_progression_events(status);
CREATE INDEX IF NOT EXISTS idx_progression_job
  ON hiring_progression_events(job_id);

-- ------------------------------------------------------------
-- 4. screening_results — persistent RAG screening (agreed).
-- Preserves original AI result on override (correction #12):
--   ai_overall/ai_status = immutable model output
--   overall/status = effective (post-override) values
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS screening_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  semantic_score NUMERIC NOT NULL DEFAULT 0,
  skills_score NUMERIC NOT NULL DEFAULT 0,
  experience_score NUMERIC NOT NULL DEFAULT 0,
  education_score NUMERIC NOT NULL DEFAULT 0,
  ai_overall NUMERIC NOT NULL DEFAULT 0,
  ai_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (ai_status IN ('pending','passed','failed')),
  overall NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','passed','failed','overridden')),
  matched_skills TEXT[] NOT NULL DEFAULT '{}',
  missing_skills TEXT[] NOT NULL DEFAULT '{}',
  explanation TEXT DEFAULT '',
  recruiter_override BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason TEXT DEFAULT '',
  override_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_screening_job
  ON screening_results(job_id);
CREATE INDEX IF NOT EXISTS idx_screening_candidate
  ON screening_results(candidate_id);
CREATE INDEX IF NOT EXISTS idx_screening_status
  ON screening_results(status);

-- ------------------------------------------------------------
-- 5. interview_invites — secure candidate links for Technical
-- and Managerial/HR rounds (provider-agnostic, correction #14).
-- Token handling mirrors assessment_invites: only token_hash
-- stored for lookup (UNIQUE), encrypted copy for resend.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interview_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'Technical Interview'
    CHECK (stage IN ('Technical Interview','Managerial/HR')),
  token_hash TEXT NOT NULL UNIQUE,
  token_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent','opened','started','completed','expired','revoked')),
  scheduled_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ DEFAULT NOW(),
  send_count INT NOT NULL DEFAULT 1 CHECK (send_count >= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(interview_id)
);

CREATE INDEX IF NOT EXISTS idx_interview_invites_candidate
  ON interview_invites(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interview_invites_recruiter
  ON interview_invites(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_interview_invites_interview
  ON interview_invites(interview_id);

-- ------------------------------------------------------------
-- 6. interview_evaluations — human interviewer evaluation
-- (NO AI interviewer). Private notes NEVER exposed to
-- candidates — enforced in app code via safe/unsafe views.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interview_evaluations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
  interviewer_name TEXT NOT NULL DEFAULT '',
  technical_knowledge INT CHECK (technical_knowledge IS NULL OR (technical_knowledge >= 1 AND technical_knowledge <= 5)),
  problem_solving INT CHECK (problem_solving IS NULL OR (problem_solving >= 1 AND problem_solving <= 5)),
  communication INT CHECK (communication IS NULL OR (communication >= 1 AND communication <= 5)),
  code_quality INT CHECK (code_quality IS NULL OR (code_quality >= 1 AND code_quality <= 5)),
  overall_recommendation TEXT NOT NULL DEFAULT 'hold'
    CHECK (overall_recommendation IN ('strong_hire','hire','no_hire','strong_no_hire','hold')),
  summary TEXT DEFAULT '',
  private_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(interview_id)
);

CREATE INDEX IF NOT EXISTS idx_interview_evals_candidate
  ON interview_evaluations(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interview_evals_interview
  ON interview_evaluations(interview_id);

-- ------------------------------------------------------------
-- 7. proctoring_events — observable signals only (correction:
-- foundation, no AI proctoring). Never claims cheating.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proctoring_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('TAB_SWITCH','FULLSCREEN_EXIT','COPY','PASTE','CAMERA_DISABLED','MIC_DISABLED','NETWORK_DISCONNECTED','NETWORK_RECONNECTED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_proctoring_attempt
  ON proctoring_events(attempt_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_candidate
  ON proctoring_events(candidate_id);

-- ------------------------------------------------------------
-- 8. candidate_sessions — short-lived HttpOnly session after
-- initial token validation (correction #9). Raw invite token
-- is exchanged once; subsequent calls use session cookie.
-- Never localStorage. Session token stored as hash only.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidate_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  invite_id UUID REFERENCES assessment_invites(id) ON DELETE SET NULL,
  interview_invite_id UUID REFERENCES interview_invites(id) ON DELETE SET NULL,
  session_hash TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL DEFAULT 'assessment'
    CHECK (scope IN ('assessment','interview')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_sessions_candidate
  ON candidate_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_sessions_expires
  ON candidate_sessions(expires_at);

-- ------------------------------------------------------------
-- 9. RLS (same convention: service_role full access,
-- ownership enforced in app code).
-- ------------------------------------------------------------
ALTER TABLE assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hiring_progression_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE screening_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE proctoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_assessment_attempts" ON assessment_attempts;
CREATE POLICY "service_role_all_assessment_attempts" ON assessment_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_assessment_answers" ON assessment_answers;
CREATE POLICY "service_role_all_assessment_answers" ON assessment_answers FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_progression_events" ON hiring_progression_events;
CREATE POLICY "service_role_all_progression_events" ON hiring_progression_events FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_screening_results" ON screening_results;
CREATE POLICY "service_role_all_screening_results" ON screening_results FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_interview_invites" ON interview_invites;
CREATE POLICY "service_role_all_interview_invites" ON interview_invites FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_interview_evals" ON interview_evaluations;
CREATE POLICY "service_role_all_interview_evals" ON interview_evaluations FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_proctoring" ON proctoring_events;
CREATE POLICY "service_role_all_proctoring" ON proctoring_events FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_candidate_sessions" ON candidate_sessions;
CREATE POLICY "service_role_all_candidate_sessions" ON candidate_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 10. Verification summary
-- ------------------------------------------------------------
DO $$
DECLARE
  v_attempts INT; v_answers INT; v_prog INT; v_screen INT;
  v_inv INT; v_eval INT; v_proct INT; v_sess INT;
BEGIN
  SELECT COUNT(*) INTO v_attempts FROM assessment_attempts;
  SELECT COUNT(*) INTO v_answers FROM assessment_answers;
  SELECT COUNT(*) INTO v_prog FROM hiring_progression_events;
  SELECT COUNT(*) INTO v_screen FROM screening_results;
  SELECT COUNT(*) INTO v_inv FROM interview_invites;
  SELECT COUNT(*) INTO v_eval FROM interview_evaluations;
  SELECT COUNT(*) INTO v_proct FROM proctoring_events;
  SELECT COUNT(*) INTO v_sess FROM candidate_sessions;
  RAISE NOTICE 'HIRING WORKFLOW MIGRATION OK: attempts=%, answers=%, progression=%, screening=%, interview_invites=%, evals=%, proctoring=%, sessions=%',
    v_attempts, v_answers, v_prog, v_screen, v_inv, v_eval, v_proct, v_sess;
END
$$;
