-- ============================================================
-- RecruitIQ Supabase Setup
-- Run this EXACTLY ONCE in your Supabase SQL editor:
-- https://supabase.com/dashboard/project/eqebnwpzbszjdntbjbpw/sql/new
-- ============================================================

-- 1. Create upload_sessions table (for JD tracking)
CREATE TABLE IF NOT EXISTS upload_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_description_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Add new columns to existing candidates table
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS upload_session_id UUID REFERENCES upload_sessions(id);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS flight_risk TEXT CHECK (flight_risk IN ('Low','Medium','High'));
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS growth_trajectory TEXT CHECK (growth_trajectory IN ('Fast-track','Steady','Stagnant'));
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS parsed_json JSONB;

-- 3. Create the resumes storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  true,
  5242880,
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 4. Allow anonymous users to upload files to resumes bucket
DROP POLICY IF EXISTS "anon_insert_resumes" ON storage.objects;
CREATE POLICY "anon_insert_resumes"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'resumes');

-- 5. Allow anonymous users to read files from resumes bucket
DROP POLICY IF EXISTS "anon_select_resumes" ON storage.objects;
CREATE POLICY "anon_select_resumes"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'resumes');

-- 6. Allow public update/delete for the bucket
DROP POLICY IF EXISTS "anon_all_resumes" ON storage.objects;
CREATE POLICY "anon_all_resumes"
ON storage.objects
FOR ALL
TO anon
USING (bucket_id = 'resumes')
WITH CHECK (bucket_id = 'resumes');

-- 7. Enable RLS on tables (if not already enabled) and allow backend inserts
ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_skills ENABLE ROW LEVEL SECURITY;

-- Allow anon to insert into upload_sessions (for generate-link)
DROP POLICY IF EXISTS "anon_insert_upload_sessions" ON upload_sessions;
CREATE POLICY "anon_insert_upload_sessions"
ON upload_sessions
FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_upload_sessions" ON upload_sessions;
CREATE POLICY "anon_select_upload_sessions"
ON upload_sessions
FOR SELECT
TO anon
USING (true);

-- Allow anon to insert/select candidates
DROP POLICY IF EXISTS "anon_insert_candidates" ON candidates;
CREATE POLICY "anon_insert_candidates"
ON candidates
FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_candidates" ON candidates;
CREATE POLICY "anon_select_candidates"
ON candidates
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "anon_update_candidates" ON candidates;
CREATE POLICY "anon_update_candidates"
ON candidates
FOR UPDATE
TO anon
USING (true);

-- Allow anon to insert/select candidate_skills
DROP POLICY IF EXISTS "anon_insert_candidate_skills" ON candidate_skills;
CREATE POLICY "anon_insert_candidate_skills"
ON candidate_skills
FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_candidate_skills" ON candidate_skills;
CREATE POLICY "anon_select_candidate_skills"
ON candidate_skills
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "anon_delete_candidate_skills" ON candidate_skills;
CREATE POLICY "anon_delete_candidate_skills"
ON candidate_skills
FOR DELETE
TO anon
USING (true);
