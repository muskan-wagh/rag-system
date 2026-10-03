-- ============================================================
-- HireStack Supabase Setup (idempotent — safe to re-run)
-- ============================================================

-- 1. Upload sessions table
CREATE TABLE IF NOT EXISTS upload_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_description_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Candidates table (created first time; ALTER statements below for upgrades)
CREATE TABLE IF NOT EXISTS candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_session_id UUID REFERENCES upload_sessions(id),
  full_name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  location TEXT DEFAULT '',
  current_company TEXT DEFAULT '',
  current_title TEXT DEFAULT '',
  total_experience_years REAL DEFAULT 0,
  raw_resume_text TEXT DEFAULT '',
  resume_file_url TEXT NOT NULL DEFAULT '',
  processing_status TEXT DEFAULT 'PENDING' CHECK (processing_status IN ('PENDING','PROCESSING','COMPLETED','FAILED')),
  source TEXT DEFAULT '',
  error_message TEXT DEFAULT '',
  flight_risk TEXT CHECK (flight_risk IN ('Low','Medium','High')),
  growth_trajectory TEXT CHECK (growth_trajectory IN ('Fast-track','Steady','Stagnant')),
  parsed_json JSONB,
  current_status TEXT DEFAULT 'Applied',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2b. Ensure all columns exist (safe for upgrades if table already existed)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS upload_session_id UUID REFERENCES upload_sessions(id);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS flight_risk TEXT CHECK (flight_risk IN ('Low','Medium','High'));
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS growth_trajectory TEXT CHECK (growth_trajectory IN ('Fast-track','Steady','Stagnant'));
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS parsed_json JSONB;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'PENDING' CHECK (processing_status IN ('PENDING','PROCESSING','COMPLETED','FAILED'));
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS source TEXT DEFAULT '';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS error_message TEXT DEFAULT '';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_file_url TEXT DEFAULT '';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_status TEXT DEFAULT 'Applied';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_title TEXT DEFAULT '';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_company TEXT DEFAULT '';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT '';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS total_experience_years REAL DEFAULT 0;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS raw_resume_text TEXT DEFAULT '';

-- 2c. Enforce NOT NULL on resume_file_url for new rows (existing nulls remain)
ALTER TABLE candidates ALTER COLUMN resume_file_url SET NOT NULL;

-- 2d. Remove UNIQUE constraint on email — multiple candidates (even same person applying to different JDs) can share an email
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_email_key;

-- 2e. Remove UNIQUE constraint on phone for the same reason
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_phone_key;

-- 3. Candidate skills table (was MISSING — now created)
CREATE TABLE IF NOT EXISTS candidate_skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(candidate_id, skill_name)
);

-- 4. Candidate experience table
CREATE TABLE IF NOT EXISTS candidate_experience (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  job_title TEXT NOT NULL,
  company TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Candidate status log
CREATE TABLE IF NOT EXISTS candidate_status_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('Pending','Shortlisted','Interview','Offer','Hired','Rejected','Applied','Screening','Technical Interview','HR Interview')),
  changed_at TIMESTAMP DEFAULT NOW()
);

-- Migrate existing 'Applied' statuses to 'Pending' if desired (opt-in, keeps backward compat)
-- UPDATE candidates SET current_status = 'Pending' WHERE current_status = 'Applied';
-- UPDATE candidate_status_log SET status = 'Pending' WHERE status = 'Applied';

-- 6. Candidate notes
CREATE TABLE IF NOT EXISTS candidate_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Search sessions
CREATE TABLE IF NOT EXISTS search_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_description_text TEXT NOT NULL,
  jd_hash TEXT,
  filters JSONB,
  result_count INT DEFAULT 0,
  search_duration_ms INT,
  user_id TEXT,
  recruiter_id UUID REFERENCES recruiters(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Email logs
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW()
);

-- 9. Interviews table
CREATE TABLE IF NOT EXISTS interviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  interview_type TEXT NOT NULL CHECK (interview_type IN ('google_meet','zoom','ms_teams','phone','in_person')),
  interviewer_name TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  meeting_link TEXT DEFAULT '',
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 10. Offers table
CREATE TABLE IF NOT EXISTS offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  salary NUMERIC,
  joining_date DATE,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'offered' CHECK (status IN ('offered','accepted','declined')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Extend candidate_status_log for richer audit trail
ALTER TABLE candidate_status_log ADD COLUMN IF NOT EXISTS changed_by TEXT DEFAULT '';
ALTER TABLE candidate_status_log ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}';

-- Update CHECK constraint on candidate_status_log.status to include new statuses
ALTER TABLE candidate_status_log DROP CONSTRAINT IF EXISTS candidate_status_log_status_check;
ALTER TABLE candidate_status_log ADD CONSTRAINT candidate_status_log_status_check
  CHECK (status IN ('Applied','Shortlisted','Screening','Interview','Interview Scheduled','Interview Completed','Technical Round','HR Round','Offered','Hired','Rejected'));

-- ============================================================
-- 11. Recruiters table (Clerk-based authentication)
-- ============================================================
CREATE TABLE IF NOT EXISTS recruiters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL DEFAULT '',
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'recruiter',
  organization_name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruiters_clerk_id ON recruiters(clerk_id);
CREATE INDEX IF NOT EXISTS idx_recruiters_email ON recruiters(email);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_candidates_upload_session_id ON candidates(upload_session_id);
CREATE INDEX IF NOT EXISTS idx_candidates_processing_status ON candidates(processing_status);
CREATE INDEX IF NOT EXISTS idx_candidates_current_status ON candidates(current_status);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON candidates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_session_created ON candidates(upload_session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_skills_candidate_id ON candidate_skills(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_skills_skill_name ON candidate_skills(skill_name);
CREATE INDEX IF NOT EXISTS idx_candidate_experience_candidate_id ON candidate_experience(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_notes_candidate_id ON candidate_notes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_status_log_candidate_id ON candidate_status_log(candidate_id);
CREATE INDEX IF NOT EXISTS idx_search_sessions_created_at ON search_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_created_at ON upload_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interviews_candidate ON interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_date ON interviews(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_offers_candidate ON offers(candidate_id);
CREATE INDEX IF NOT EXISTS idx_status_log_candidate_time ON candidate_status_log(candidate_id, changed_at DESC);

-- ============================================================
-- Storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes', 'resumes', true, 5242880,
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RLS policies
-- ============================================================
DROP POLICY IF EXISTS "anon_insert_resumes" ON storage.objects;
CREATE POLICY "anon_insert_resumes" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'resumes');

DROP POLICY IF EXISTS "anon_select_resumes" ON storage.objects;
CREATE POLICY "anon_select_resumes" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'resumes');

ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_upload_sessions" ON upload_sessions;
CREATE POLICY "anon_insert_upload_sessions" ON upload_sessions FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_upload_sessions" ON upload_sessions;
CREATE POLICY "anon_select_upload_sessions" ON upload_sessions FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "service_role_all_candidates" ON candidates;
CREATE POLICY "service_role_all_candidates" ON candidates FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_candidates" ON candidates;
CREATE POLICY "anon_insert_candidates" ON candidates FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_candidates" ON candidates;
CREATE POLICY "anon_select_candidates" ON candidates FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "service_role_all_candidate_skills" ON candidate_skills;
CREATE POLICY "service_role_all_candidate_skills" ON candidate_skills FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_candidate_skills" ON candidate_skills;
CREATE POLICY "anon_insert_candidate_skills" ON candidate_skills FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_candidate_skills" ON candidate_skills;
CREATE POLICY "anon_select_candidate_skills" ON candidate_skills FOR SELECT TO anon USING (true);

ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_interviews" ON interviews;
CREATE POLICY "anon_insert_interviews" ON interviews FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_interviews" ON interviews;
CREATE POLICY "anon_select_interviews" ON interviews FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_update_interviews" ON interviews;
CREATE POLICY "anon_update_interviews" ON interviews FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_offers" ON offers;
CREATE POLICY "anon_insert_offers" ON offers FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_offers" ON offers;
CREATE POLICY "anon_select_offers" ON offers FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_update_offers" ON offers;
CREATE POLICY "anon_update_offers" ON offers FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- RECRUITER OWNERSHIP
-- Add recruiter_id to all owned tables
-- ============================================================
ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS recruiter_id UUID REFERENCES recruiters(id);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS recruiter_id UUID REFERENCES recruiters(id);
ALTER TABLE candidate_notes ADD COLUMN IF NOT EXISTS recruiter_id UUID REFERENCES recruiters(id);
ALTER TABLE candidate_status_log ADD COLUMN IF NOT EXISTS recruiter_id UUID REFERENCES recruiters(id);
ALTER TABLE search_sessions ADD COLUMN IF NOT EXISTS recruiter_id UUID REFERENCES recruiters(id);
ALTER TABLE search_sessions ADD COLUMN IF NOT EXISTS jd_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_upload_sessions_recruiter ON upload_sessions(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_candidates_recruiter ON candidates(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_candidate_notes_recruiter ON candidate_notes(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_candidate_status_log_recruiter ON candidate_status_log(recruiter_id);

-- ============================================================
-- ADDITIONAL PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_candidates_recruiter_created ON candidates(recruiter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_recruiter_status ON candidates(recruiter_id, current_status);
CREATE INDEX IF NOT EXISTS idx_candidates_recruiter_session ON candidates(recruiter_id, upload_session_id);
CREATE INDEX IF NOT EXISTS idx_search_sessions_recruiter ON search_sessions(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_interviews_date_status ON interviews(scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_recruiter_created ON upload_sessions(recruiter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_status_log_changed ON candidate_status_log(changed_at DESC);

-- ============================================================
-- 12. Saved Searches
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recruiter_id UUID REFERENCES recruiters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  jd_text TEXT NOT NULL DEFAULT '',
  filters JSONB DEFAULT '{}',
  embedding VECTOR(384),
  is_favorite BOOLEAN DEFAULT FALSE,
  usage_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_recruiter ON saved_searches(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_favorite ON saved_searches(recruiter_id, is_favorite);

-- 13. Talent Pools
CREATE TABLE IF NOT EXISTS talent_pools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recruiter_id UUID REFERENCES recruiters(id) ON DELETE CASCADE,
  saved_search_id UUID REFERENCES saved_searches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_talent_pools_recruiter ON talent_pools(recruiter_id);

-- 14. Talent Pool Candidates
CREATE TABLE IF NOT EXISTS talent_pool_candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID REFERENCES talent_pools(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  match_score FLOAT DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pool_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_tpc_pool ON talent_pool_candidates(pool_id);
CREATE INDEX IF NOT EXISTS idx_tpc_candidate ON talent_pool_candidates(candidate_id);

-- 15. Search History
CREATE TABLE IF NOT EXISTS search_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recruiter_id UUID REFERENCES recruiters(id) ON DELETE CASCADE,
  jd_text TEXT NOT NULL DEFAULT '',
  filters JSONB DEFAULT '{}',
  result_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_history_recruiter ON search_history(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_search_history_created ON search_history(recruiter_id, created_at DESC);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE talent_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE talent_pool_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_saved_searches" ON saved_searches;
CREATE POLICY "service_role_all_saved_searches" ON saved_searches FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_talent_pools" ON talent_pools;
CREATE POLICY "service_role_all_talent_pools" ON talent_pools FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_talent_pool_candidates" ON talent_pool_candidates;
CREATE POLICY "service_role_all_talent_pool_candidates" ON talent_pool_candidates FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_search_history" ON search_history;
CREATE POLICY "service_role_all_search_history" ON search_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Stats RPC function for per-recruiter dashboard aggregation
CREATE OR REPLACE FUNCTION get_recruiter_stats(p_recruiter_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH session_ids AS (
    SELECT id FROM upload_sessions WHERE recruiter_id = p_recruiter_id
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
    FROM candidates c
    WHERE c.recruiter_id = p_recruiter_id
  ),
  interview_count AS (
    SELECT COUNT(*) AS interviews_today
    FROM interviews i
    JOIN candidates c ON c.id = i.candidate_id
    WHERE c.recruiter_id = p_recruiter_id
      AND i.scheduled_date = CURRENT_DATE
      AND i.status = 'scheduled'
  ),
  candidate_counts AS (
    SELECT
      COUNT(*) AS total_candidates,
      COUNT(*) FILTER (WHERE c.created_at >= CURRENT_DATE) AS uploaded_today
    FROM candidates c
    WHERE c.recruiter_id = p_recruiter_id
  ),
  search_counts AS (
    SELECT COUNT(*) AS searches
    FROM search_sessions s
    WHERE s.recruiter_id = p_recruiter_id
  ),
  upload_days AS (
    SELECT COUNT(DISTINCT DATE(c.created_at)) AS active_days
    FROM candidates c
    WHERE c.recruiter_id = p_recruiter_id
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

-- Stats RPC function for efficient dashboard aggregation (per-session, kept for backward compat)
CREATE OR REPLACE FUNCTION get_session_stats_new(p_session_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH status_agg AS (
    SELECT
      COUNT(*) FILTER (WHERE LOWER(c.current_status) IN ('applied','shortlisted')) AS open,
      COUNT(*) FILTER (WHERE LOWER(c.current_status) = 'applied') AS applied,
      COUNT(*) FILTER (WHERE LOWER(c.current_status) = 'screening') AS screening,
      COUNT(*) FILTER (WHERE LOWER(c.current_status) = 'interview') AS interview,
      COUNT(*) FILTER (WHERE LOWER(c.current_status) = 'offered') AS offered,
      COUNT(*) FILTER (WHERE LOWER(c.current_status) = 'hired') AS hired,
      COUNT(*) FILTER (WHERE LOWER(c.current_status) = 'rejected') AS rejected
    FROM candidates c
    WHERE c.upload_session_id = p_session_id
  ),
  interview_count AS (
    SELECT COUNT(*) AS interviews_today
    FROM interviews i
    JOIN candidates c ON c.id = i.candidate_id
    WHERE c.upload_session_id = p_session_id
      AND i.scheduled_date = CURRENT_DATE
      AND i.status = 'scheduled'
  )
  SELECT json_build_object(
    'open', sa.open,
    'applied', sa.applied,
    'screening', sa.screening,
    'interview', sa.interview,
    'interviewsToday', ic.interviews_today,
    'offered', sa.offered,
    'hired', sa.hired,
    'rejected', sa.rejected
  ) INTO result
  FROM status_agg sa, interview_count ic;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 16. Gmail OAuth (LEGACY plaintext columns — DEPRECATED)
-- New code uses gmail_connections (section 17) with AES-256-GCM
-- encrypted tokens. Legacy columns are migrated lazily then NULLED.
-- Do NOT write to these from new code.
-- ============================================================
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS gmail_connected_email TEXT DEFAULT '';
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT DEFAULT '';
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS gmail_connected_at TIMESTAMPTZ;

-- ============================================================
-- 17. Gmail connections (canonical, encrypted token store)
-- Tokens are read/written with the service_role key only.
-- Never expose *_encrypted columns to the browser.
-- ============================================================
CREATE TABLE IF NOT EXISTS gmail_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recruiter_id UUID NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
  google_account_id TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','error')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gmail_conn_recruiter_account
  ON gmail_connections(recruiter_id, google_account_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gmail_conn_recruiter_email
  ON gmail_connections(recruiter_id, email);
CREATE INDEX IF NOT EXISTS idx_gmail_conn_recruiter ON gmail_connections(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_gmail_conn_status ON gmail_connections(recruiter_id, status);

-- email_logs extensions (provider-aware, event-keyed idempotency)
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS recruiter_id UUID REFERENCES recruiters(id) ON DELETE SET NULL;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'resend';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_logs_recruiter_idem
  ON email_logs(recruiter_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_logs_recruiter_provider
  ON email_logs(recruiter_id, provider);

-- ============================================================
-- 18. Recruiter Assessment Builder (2026-10-01) — RECRUITER SIDE ONLY
-- Job -> Hiring Stage -> Assessment -> Questions + Invites
-- (mirrors backend/supabase/migrations/20261001_assessments.sql)
--
-- FRESH INSTALLS ONLY. If your database already contains legacy
-- assessment tables (jobs, assessments, assessment_questions,
-- assessment_invites, hiring_rounds from the RAG pipeline), do NOT
-- run this block — run backend/supabase/migrations/
-- 20261001_assessments.sql instead (reconciliation v2, ADD COLUMN
-- based, preserves data). Running the plain CREATEs below against
-- such a DB fails (e.g. 42703 on missing columns) because
-- CREATE TABLE IF NOT EXISTS skips tables whose schema differs.
-- ============================================================

-- Minimal jobs (upload_session_id is an OPTIONAL legacy bridge, never required)
CREATE TABLE IF NOT EXISTS jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recruiter_id UUID NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
  upload_session_id UUID REFERENCES upload_sessions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_recruiter
  ON jobs(recruiter_id);

-- Hiring stages: one row per (job, stage_type); API reuses existing rows
CREATE TABLE IF NOT EXISTS hiring_stages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
  stage_type TEXT NOT NULL
    CHECK (stage_type IN ('Screening','Assessment','Interview','Offer','Hired')),
  position INT NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, stage_type)
);

CREATE INDEX IF NOT EXISTS idx_hiring_stages_job
  ON hiring_stages(job_id);

-- Assessments (settings are config-only this phase; not enforced candidate-side)
CREATE TABLE IF NOT EXISTS assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recruiter_id UUID NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  hiring_stage_id UUID REFERENCES hiring_stages(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  instructions TEXT DEFAULT '',
  duration_minutes INT NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  passing_score NUMERIC NOT NULL DEFAULT 0 CHECK (passing_score >= 0),
  skills TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  settings JSONB NOT NULL DEFAULT '{"randomize_questions":false,"allow_revisit":true,"auto_submit":true}',
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessments_recruiter
  ON assessments(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_assessments_job
  ON assessments(job_id);
CREATE INDEX IF NOT EXISTS idx_assessments_hiring_stage
  ON assessments(hiring_stage_id);

-- Questions (single table, type-discriminated payload)
CREATE TABLE IF NOT EXISTS assessment_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mcq','coding','sql','subjective')),
  position INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}',
  marks NUMERIC NOT NULL DEFAULT 1 CHECK (marks >= 0),
  skill_tag TEXT DEFAULT '',
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment_position
  ON assessment_questions(assessment_id, position);

-- Invites (canonical token system; only sent/revoked used recruiter-side;
-- opened/started/expired reserved for the future candidate phase)
CREATE TABLE IF NOT EXISTS assessment_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL UNIQUE,
  -- Encrypted copy of the opaque token (AES-256-GCM, key derived from the
  -- server's service_role key — no new env vars). Needed so Resend can reuse
  -- the SAME token/link without generating a new one.
  token_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent','opened','started','expired','revoked')),
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ DEFAULT NOW(),
  send_count INT NOT NULL DEFAULT 1 CHECK (send_count >= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assessment_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_invites_assessment_candidate
  ON assessment_invites(assessment_id, candidate_id);
CREATE INDEX IF NOT EXISTS idx_assessment_invites_recruiter
  ON assessment_invites(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_assessment_invites_candidate
  ON assessment_invites(candidate_id);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hiring_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_jobs" ON jobs;
CREATE POLICY "service_role_all_jobs" ON jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_hiring_stages" ON hiring_stages;
CREATE POLICY "service_role_all_hiring_stages" ON hiring_stages FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_assessments" ON assessments;
CREATE POLICY "service_role_all_assessments" ON assessments FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_assessment_questions" ON assessment_questions;
CREATE POLICY "service_role_all_assessment_questions" ON assessment_questions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_assessment_invites" ON assessment_invites;
CREATE POLICY "service_role_all_assessment_invites" ON assessment_invites FOR ALL TO service_role USING (true) WITH CHECK (true);
