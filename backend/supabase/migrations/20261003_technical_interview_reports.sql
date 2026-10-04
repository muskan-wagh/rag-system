-- ============================================================
-- HireStack Technical Interview + Live Coding + Reports (2026-10-03)
-- Extends existing interviews / invites / progression infra.
-- Does NOT duplicate RAG, assessment, Monaco, execution,
-- candidate auth, WS, Resend/BullMQ, progressionService.
-- Safe to re-run (IF NOT EXISTS + guarded ALTERs).
-- ============================================================

-- ------------------------------------------------------------
-- 0. interviews.status: add joined / in_progress / no_show
-- Existing: scheduled, completed, cancelled (legacy setup).
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'interviews'
  ) THEN
    ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_status_check;
    ALTER TABLE interviews ADD CONSTRAINT interviews_status_check
      CHECK (status IN ('scheduled','joined','in_progress','completed','cancelled','no_show'));
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 1. interview_invites.version — reschedule bumps version;
-- old versions can never access outdated state (checked in app).
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'interview_invites' AND column_name = 'version'
  ) THEN
    ALTER TABLE interview_invites ADD COLUMN version INT NOT NULL DEFAULT 1 CHECK (version >= 1);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_interview_invites_version
  ON interview_invites(interview_id, version);

-- ------------------------------------------------------------
-- 2. interview_problems — reusable human-selected coding prompts.
-- No hidden tests here: interview runs use visible execution only
-- via the existing CodeExecutionService (runVisibleCode).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interview_problems (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  starter_code TEXT NOT NULL DEFAULT '',
  languages TEXT[] NOT NULL DEFAULT '{javascript}',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE interview_problems ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_interview_problems" ON interview_problems;
CREATE POLICY "service_role_all_interview_problems" ON interview_problems FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed 3 generic problems (fixed ids so re-runs are no-ops).
INSERT INTO interview_problems (id, title, description, starter_code, languages) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Two Sum',
   'Given an array of integers nums and an integer target, return indices of the two numbers that add up to target. Assume exactly one solution; do not reuse the same element.',
   'function twoSum(nums, target) {\n  // TODO: implement\n  return [];\n}\n',
   '{javascript}'),
  ('22222222-2222-4222-8222-222222222222', 'Reverse String',
   'Write a function that reverses a string. The input string is given as a plain string; return the reversed string.',
   'function reverseString(s) {\n  // TODO: implement\n  return "";\n}\n',
   '{javascript}'),
  ('33333333-3333-4333-8333-333333333333', 'FizzBuzz',
   'Print numbers from 1 to n. For multiples of 3 print "Fizz", multiples of 5 print "Buzz", multiples of both print "FizzBuzz". Return an array of strings.',
   'function fizzBuzz(n) {\n  // TODO: implement\n  return [];\n}\n',
   '{javascript}')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 3. interview_coding_sessions — PERSISTED server truth for the
-- shared live-coding workspace. Survives WS disconnect/refresh;
-- evaluation + reports read THIS table, never the socket.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interview_coding_sessions (
  interview_id UUID PRIMARY KEY REFERENCES interviews(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES interview_problems(id) ON DELETE SET NULL,
  language TEXT NOT NULL DEFAULT 'javascript',
  starter_code TEXT NOT NULL DEFAULT '',
  candidate_code TEXT NOT NULL DEFAULT '',
  run_state TEXT NOT NULL DEFAULT 'idle'
    CHECK (run_state IN ('idle','running','succeeded','failed')),
  output JSONB NOT NULL DEFAULT '{}',
  session_state TEXT NOT NULL DEFAULT 'live'
    CHECK (session_state IN ('live','ended')),
  version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coding_sessions_problem
  ON interview_coding_sessions(problem_id);

ALTER TABLE interview_coding_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_coding_sessions" ON interview_coding_sessions;
CREATE POLICY "service_role_all_coding_sessions" ON interview_coding_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 4. candidate_reports — structured snapshot (payload JSONB) +
-- PDF pointer (pdf_storage_path). PDF binary is NEVER in JSONB;
-- it lives in the private `candidate-reports` storage bucket.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidate_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('internal','candidate')),
  version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
  payload JSONB NOT NULL DEFAULT '{}',
  pdf_storage_path TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by TEXT,
  email_sent_at TIMESTAMPTZ,
  email_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending','queued','sent','failed')),
  email_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, report_type, version)
);

CREATE INDEX IF NOT EXISTS idx_candidate_reports_candidate
  ON candidate_reports(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_reports_job
  ON candidate_reports(job_id);
CREATE INDEX IF NOT EXISTS idx_candidate_reports_type
  ON candidate_reports(report_type);

ALTER TABLE candidate_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_candidate_reports" ON candidate_reports;
CREATE POLICY "service_role_all_candidate_reports" ON candidate_reports FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 5. Private storage bucket for report PDFs (signed URLs only).
-- Guarded: self-hosted/local DBs without the storage schema skip this
-- (the app surfaces a clear error on PDF upload instead of failing migrate).
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('candidate-reports', 'candidate-reports', false)
    ON CONFLICT (id) DO NOTHING;
  ELSE
    RAISE NOTICE 'storage schema absent — skipping candidate-reports bucket creation';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'service_role_all_candidate_reports_bucket'
    ) THEN
      CREATE POLICY "service_role_all_candidate_reports_bucket"
        ON storage.objects FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 6. Verification
-- ------------------------------------------------------------
DO $$
DECLARE
  v_prob INT; v_sess INT; v_rep INT;
BEGIN
  SELECT COUNT(*) INTO v_prob FROM interview_problems;
  SELECT COUNT(*) INTO v_sess FROM interview_coding_sessions;
  SELECT COUNT(*) INTO v_rep FROM candidate_reports;
  RAISE NOTICE 'TECHNICAL+REPORTS MIGRATION OK: problems=%, coding_sessions=%, reports=%',
    v_prob, v_sess, v_rep;
END
$$;
