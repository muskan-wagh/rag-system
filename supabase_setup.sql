-- ============================================================
-- RecruitIQ Supabase Setup (idempotent — safe to re-run)
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

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_candidates_upload_session_id ON candidates(upload_session_id);
CREATE INDEX IF NOT EXISTS idx_candidates_processing_status ON candidates(processing_status);
CREATE INDEX IF NOT EXISTS idx_candidates_current_status ON candidates(current_status);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON candidates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_session_status ON candidates(upload_session_id, current_status);
CREATE INDEX IF NOT EXISTS idx_candidate_skills_candidate_id ON candidate_skills(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_skills_skill_name ON candidate_skills(skill_name);
CREATE INDEX IF NOT EXISTS idx_candidate_experience_candidate_id ON candidate_experience(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_notes_candidate_id ON candidate_notes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_status_log_candidate_id ON candidate_status_log(candidate_id);
CREATE INDEX IF NOT EXISTS idx_search_sessions_created_at ON search_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_created_at ON upload_sessions(created_at DESC);

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
