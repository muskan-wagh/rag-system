-- ============================================================
-- Recruiter Assessment Builder (2026-10-01) — RECONCILIATION v2
--
-- The live database already contains a RAG-generated pipeline
-- (jobs, hiring_processes, hiring_rounds, assessments, assessment_
-- questions, job_applications, assessment_invites, assessment_
-- results) created outside this repo. This migration REUSES those
-- tables instead of duplicating them:
--
--   - CREATE TABLE IF NOT EXISTS is a no-op where tables exist.
--   - Missing columns used by the recruiter builder API are added
--     with ADD COLUMN IF NOT EXISTS (legacy columns are kept).
--   - Backfills copy legacy values into the new columns
--     (recruiter_id, name/title, type/question_type, payload, ...).
--   - hiring_stages is the only brand-new table (no conflict).
--
-- Single source of truth going forward:
--   assessments.hiring_stage_id -> hiring_stages.id
-- Legacy link columns (hiring_round_id, question_type, skill,
-- invite_email, token, job_application_id) are left untouched for
-- the system that owns them.
--
-- Idempotent — safe to re-run. Verify with the notices at the end.
-- ============================================================

-- ------------------------------------------------------------
-- 1. jobs — only `description` is missing for the builder API.
--    (title, recruiter_id, upload_session_id already exist;
--    minimal inserts of {title, recruiter_id} were verified
--    against the live DB: remaining columns default/nullable.)
-- ------------------------------------------------------------
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_jobs_recruiter
  ON jobs(recruiter_id);

-- ------------------------------------------------------------
-- 2. hiring_stages — brand-new table (no live conflict).
--    One row per (job, stage_type); the API reuses the existing
--    Assessment row instead of duplicating it.
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 3. assessments — add builder columns, backfill, keep legacy.
--    Existing: id, job_id, hiring_round_id, title, instructions,
--    duration_minutes, passing_score, status, version,
--    generated_by, created_at, updated_at.
-- ------------------------------------------------------------
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS recruiter_id UUID REFERENCES recruiters(id) ON DELETE CASCADE;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS hiring_stage_id UUID REFERENCES hiring_stages(id) ON DELETE SET NULL;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{"randomize_questions":false,"allow_revisit":true,"auto_submit":true}';
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS available_from TIMESTAMPTZ;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS available_until TIMESTAMPTZ;

-- Backfill recruiter from the linked job (only where valid).
UPDATE assessments a
SET recruiter_id = j.recruiter_id
FROM jobs j
JOIN recruiters r ON r.id = j.recruiter_id
WHERE a.job_id = j.id
  AND a.recruiter_id IS NULL;

-- Backfill display name from legacy title.
UPDATE assessments
SET name = title
WHERE name IS NULL
  AND title IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assessments_recruiter
  ON assessments(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_assessments_job
  ON assessments(job_id);
CREATE INDEX IF NOT EXISTS idx_assessments_hiring_stage
  ON assessments(hiring_stage_id);

-- ------------------------------------------------------------
-- 4. assessment_questions — add builder columns, backfill payload.
--    Existing: id, assessment_id, question_type, prompt, options,
--    expected_answer, marks, skill, difficulty, language,
--    starter_code, test_cases, position, created_at.
--    Legacy rows keep NULL correct answers / empty test cases:
--    the builder editor requires them on next edit (by design).
-- ------------------------------------------------------------
ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}';
ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS skill_tag TEXT DEFAULT '';
ALTER TABLE assessment_questions ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE assessment_questions
SET type = question_type
WHERE type IS NULL
  AND question_type IS NOT NULL;

UPDATE assessment_questions
SET skill_tag = skill
WHERE (skill_tag IS NULL OR skill_tag = '')
  AND skill IS NOT NULL
  AND skill <> '';

UPDATE assessment_questions
SET payload = CASE type
  WHEN 'mcq' THEN jsonb_build_object(
    'options', COALESCE(to_jsonb(options), '[]'::jsonb),
    'correct_option_id', NULL)
  WHEN 'coding' THEN jsonb_build_object(
    'language', COALESCE(language, ''),
    'starter_code', COALESCE(starter_code, ''),
    'test_cases', COALESCE(to_jsonb(test_cases), '[]'::jsonb))
  WHEN 'sql' THEN jsonb_build_object(
    'schema_ddl', '',
    'expected_query', COALESCE(expected_answer, ''),
    'expected_result', '')
  ELSE jsonb_build_object(
    'rubric', COALESCE(expected_answer, ''))
END
WHERE payload = '{}'::jsonb;

-- Named CHECK (drop-then-add keeps re-runs safe).
ALTER TABLE assessment_questions DROP CONSTRAINT IF EXISTS assessment_questions_type_check;
ALTER TABLE assessment_questions ADD CONSTRAINT assessment_questions_type_check
  CHECK (type IN ('mcq','coding','sql','subjective'));

CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment_position
  ON assessment_questions(assessment_id, position);

-- ------------------------------------------------------------
-- 5. assessment_invites — add builder columns, backfill identity.
--    Existing: id, assessment_id, job_application_id, token
--    (plaintext, legacy system), status, deadline_at, invited_at,
--    started_at, completed_at, invite_email, created_by, created_at.
-- ------------------------------------------------------------
ALTER TABLE assessment_invites ADD COLUMN IF NOT EXISTS candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE;
ALTER TABLE assessment_invites ADD COLUMN IF NOT EXISTS recruiter_id UUID REFERENCES recruiters(id) ON DELETE CASCADE;
ALTER TABLE assessment_invites ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE assessment_invites ADD COLUMN IF NOT EXISTS token_hash TEXT;
ALTER TABLE assessment_invites ADD COLUMN IF NOT EXISTS token_encrypted TEXT;
ALTER TABLE assessment_invites ADD COLUMN IF NOT EXISTS available_from TIMESTAMPTZ;
ALTER TABLE assessment_invites ADD COLUMN IF NOT EXISTS available_until TIMESTAMPTZ;
ALTER TABLE assessment_invites ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE assessment_invites ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;
ALTER TABLE assessment_invites ADD COLUMN IF NOT EXISTS send_count INT NOT NULL DEFAULT 1 CHECK (send_count >= 1);

-- candidate via the legacy application link (only where valid).
UPDATE assessment_invites i
SET candidate_id = ja.candidate_id
FROM job_applications ja
JOIN candidates c ON c.id = ja.candidate_id
WHERE i.job_application_id = ja.id
  AND i.candidate_id IS NULL;

-- recruiter via assessment -> job (only where valid).
UPDATE assessment_invites i
SET recruiter_id = j.recruiter_id
FROM assessments a
JOIN jobs j ON j.id = a.job_id
JOIN recruiters r ON r.id = j.recruiter_id
WHERE i.assessment_id = a.id
  AND i.recruiter_id IS NULL;

UPDATE assessment_invites
SET email = invite_email
WHERE (email IS NULL OR email = '')
  AND invite_email IS NOT NULL;

UPDATE assessment_invites
SET sent_at = invited_at
WHERE sent_at IS NULL
  AND invited_at IS NOT NULL;

UPDATE assessment_invites
SET sent_at = created_at
WHERE sent_at IS NULL;

UPDATE assessment_invites
SET last_sent_at = sent_at
WHERE last_sent_at IS NULL;

ALTER TABLE assessment_invites ALTER COLUMN sent_at SET DEFAULT NOW();
ALTER TABLE assessment_invites ALTER COLUMN last_sent_at SET DEFAULT NOW();

-- Hash legacy plaintext tokens (pgcrypto may be absent — never fail).
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  UPDATE assessment_invites
  SET token_hash = encode(digest(token, 'sha256'), 'hex')
  WHERE token_hash IS NULL
    AND token IS NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgcrypto unavailable, skipping legacy token_hash backfill: %', SQLERRM;
END
$$;

-- Status CHECK covering both systems (legacy 'completed' + builder states).
ALTER TABLE assessment_invites DROP CONSTRAINT IF EXISTS assessment_invites_status_check;
ALTER TABLE assessment_invites ADD CONSTRAINT assessment_invites_status_check
  CHECK (status IN ('sent','opened','started','expired','revoked','completed'));

-- Canonical dedupe: one live builder invite per (assessment, candidate).
-- NULL candidate_ids never conflict in Postgres UNIQUE.
ALTER TABLE assessment_invites DROP CONSTRAINT IF EXISTS uq_assessment_invites_assessment_candidate;
ALTER TABLE assessment_invites ADD CONSTRAINT uq_assessment_invites_assessment_candidate
  UNIQUE (assessment_id, candidate_id);

ALTER TABLE assessment_invites DROP CONSTRAINT IF EXISTS uq_assessment_invites_token_hash;
ALTER TABLE assessment_invites ADD CONSTRAINT uq_assessment_invites_token_hash
  UNIQUE (token_hash);

CREATE INDEX IF NOT EXISTS idx_assessment_invites_assessment_candidate
  ON assessment_invites(assessment_id, candidate_id);
CREATE INDEX IF NOT EXISTS idx_assessment_invites_recruiter
  ON assessment_invites(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_assessment_invites_candidate
  ON assessment_invites(candidate_id);

-- ------------------------------------------------------------
-- 6. RLS (same convention as the repo schema: service_role has
--    full access; recruiter ownership enforced in app code)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 7. Verification summary (shown in the Supabase SQL output)
-- ------------------------------------------------------------
DO $$
DECLARE
  v_jobs INT; v_stages INT; v_assess INT; v_assess_orphan INT;
  v_q INT; v_q_untyped INT; v_inv INT; v_inv_nocand INT;
BEGIN
  SELECT COUNT(*) INTO v_jobs FROM jobs;
  SELECT COUNT(*) INTO v_stages FROM hiring_stages;
  SELECT COUNT(*) INTO v_assess FROM assessments;
  SELECT COUNT(*) INTO v_assess_orphan FROM assessments WHERE recruiter_id IS NULL;
  SELECT COUNT(*) INTO v_q FROM assessment_questions;
  SELECT COUNT(*) INTO v_q_untyped FROM assessment_questions WHERE type IS NULL;
  SELECT COUNT(*) INTO v_inv FROM assessment_invites;
  SELECT COUNT(*) INTO v_inv_nocand FROM assessment_invites WHERE candidate_id IS NULL;
  RAISE NOTICE 'ASSESSMENT MIGRATION OK: jobs=%, hiring_stages=%, assessments=% (recruiter NULL: %), questions=% (untyped: %), invites=% (no candidate: %)',
    v_jobs, v_stages, v_assess, v_assess_orphan, v_q, v_q_untyped, v_inv, v_inv_nocand;
END
$$;
